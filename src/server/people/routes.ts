import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../app.js";
import { requireActor, requireGrownUp, sessionCookie, sessionCookieOptions as cookieOptions } from "./authenticate.js";
import type { People } from "./people.js";
import type { Mailer } from "../email.js";
import type { Limit, RateLimits } from "../rate-limits.js";

// A password needs to be at least this long.
const passwordField = { type: "string", minLength: 8, maxLength: 200 } as const;

export async function peopleRoutes(app: FastifyInstance, people: People, config: AppConfig, mailer: Mailer, rateLimits: RateLimits) {
  app.post<{ Body: { email: string; password: string; chartName: string; timeZone: string } }>(
    "/api/sign-up",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email", maxLength: 200 },
            password: passwordField,
            chartName: { type: "string", minLength: 1, maxLength: 60, pattern: "\\S" },
            timeZone: { type: "string", minLength: 1, maxLength: 60 },
          },
          required: ["email", "password", "chartName", "timeZone"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (!config.allowNewCharts) return reply.code(403).send({ error: "new charts can't be created on this server" });
      if (rateLimits.refuse(reply, [["signUpsPerAddress", request.ip]])) return reply;
      rateLimits.count("signUpsPerAddress", request.ip);
      const result = await people.signUp(request.body);
      if ("refused" in result) {
        if (result.refused === "email-in-use") return reply.code(409).send({ error: "that email is already in use" });
        return reply.code(400).send({ error: "that isn't a time zone we recognise" });
      }
      reply.setCookie(sessionCookie, result.token, cookieOptions);
      return reply.code(201).send({});
    },
  );

  app.post<{ Body: { email: string; password: string } }>("/api/sign-in", async (request, reply) => {
    const email = String(request.body?.email ?? "").trim();
    const limitsHere: [Limit, string][] = [
      ["wrongPasswordsPerAccount", email],
      ["wrongPasswordsPerAddress", request.ip],
    ];
    if (rateLimits.refuse(reply, limitsHere)) return reply;
    const token = await people.signIn(request.body);
    if (!token) {
      for (const [limit, who] of limitsHere) rateLimits.count(limit, who);
      return reply.code(401).send({ error: "email or password is wrong" });
    }
    reply.setCookie(sessionCookie, token, cookieOptions);
    return {};
  });

  app.put<{ Body: { pin: string } }>(
    "/api/me/pin",
    {
      schema: {
        body: {
          type: "object",
          properties: { pin: { type: "string", pattern: "^[0-9]{4,8}$" } },
          required: ["pin"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      await people.setPin(signedIn.grownUp.id, request.body.pin);
      return reply.code(204).send();
    },
  );

  // An unlocked observatory shows this code as a QR; the grown-up's phone claims it to sign in as them.
  app.post("/api/phone-setup", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    return reply.code(201).send(await people.newPhoneSetupCode(signedIn.grownUp.id));
  });

  app.post<{ Body: { code: string } }>(
    "/api/phone-setup/claim",
    {
      schema: {
        body: {
          type: "object",
          properties: { code: { type: "string", minLength: 1, maxLength: 100 } },
          required: ["code"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (rateLimits.refuse(reply, [["wrongCodesPerAddress", request.ip]])) return reply;
      const token = await people.claimPhoneSetupCode(request.body.code);
      if (!token) rateLimits.count("wrongCodesPerAddress", request.ip);
      if (!token) return reply.code(404).send({ error: "That code has expired or was already used. Show a new one." });
      reply.setCookie(sessionCookie, token, cookieOptions);
      return {};
    },
  );

  app.post<{ Body: { email: string } }>(
    "/api/invitations",
    {
      schema: {
        body: {
          type: "object",
          properties: { email: { type: "string", format: "email", maxLength: 200 } },
          required: ["email"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      if (signedIn.grownUp.role === "grown-up") {
        return reply.code(403).send({ error: "Only the chart's owner and admins can invite grown-ups." });
      }
      const token = await people.invite({
        chartId: signedIn.chart.id,
        invitedBy: signedIn.grownUp.id,
        email: request.body.email,
      });
      await mailer.send({
        to: request.body.email,
        subject: `You're invited to ${signedIn.chart.name} on Star Chart`,
        text: [
          `${signedIn.grownUp.email} has invited you to help run ${signedIn.chart.name} on Star Chart.`,
          "",
          "Choose a password to join:",
          `${config.appUrl}/accept-invitation.html#token=${encodeURIComponent(token)}`,
          "",
          "This link works once and expires in 7 days.",
        ].join("\n"),
      });
      return reply.code(201).send({});
    },
  );

  app.post<{ Body: { token: string; password: string } }>(
    "/api/invitations/accept",
    {
      schema: {
        body: {
          type: "object",
          properties: { token: { type: "string", minLength: 1, maxLength: 100 }, password: passwordField },
          required: ["token", "password"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (rateLimits.refuse(reply, [["wrongCodesPerAddress", request.ip]])) return reply;
      const result = await people.acceptInvitation(request.body.token, request.body.password);
      if ("refused" in result) {
        if (result.refused === "email-in-use") {
          return reply.code(409).send({ error: "That email already belongs to a chart. Ask for an invitation to another email." });
        }
        rateLimits.count("wrongCodesPerAddress", request.ip);
        return reply.code(404).send({ error: "That invitation has expired or was already used. Ask for a new one." });
      }
      reply.setCookie(sessionCookie, result.token, cookieOptions);
      return {};
    },
  );

  app.get("/api/grown-ups", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    return { grownUps: await people.grownUpsIn(signedIn.chart.id) };
  });

  app.patch<{ Params: { grownUpId: string }; Body: { role: "admin" | "grown-up" } }>(
    "/api/grown-ups/:grownUpId",
    {
      schema: {
        body: {
          type: "object",
          properties: { role: { type: "string", enum: ["admin", "grown-up"] } },
          required: ["role"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      if (signedIn.grownUp.role !== "owner") {
        return reply.code(403).send({ error: "Only the chart's owner can change who is an admin." });
      }
      const result = await people.setRole(signedIn.chart.id, request.params.grownUpId, request.body.role);
      if ("refused" in result) {
        if (result.refused === "is-owner") {
          return reply.code(409).send({ error: "The owner stays the owner until they hand ownership to an admin." });
        }
        return reply.code(404).send({ error: "no such grown-up" });
      }
      return { grownUp: result };
    },
  );

  // Always the same answer, whether or not the email belongs to anyone, so it can't be used to find accounts.
  app.post<{ Body: { email: string } }>(
    "/api/password-reset",
    {
      schema: {
        body: {
          type: "object",
          properties: { email: { type: "string", maxLength: 200 } },
          required: ["email"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (rateLimits.refuse(reply, [["resetRequestsPerAddress", request.ip]])) return reply;
      rateLimits.count("resetRequestsPerAddress", request.ip);
      // Past an account's limit the answer looks the same, but no email (and no new link) is made.
      const email = request.body.email.trim();
      if (rateLimits.waitFor("resetEmailsPerAccount", email) !== undefined) return reply.code(204).send();
      rateLimits.count("resetEmailsPerAccount", email);
      const token = await people.requestPasswordReset(request.body.email);
      if (token) {
        // Sent in the background, so the reply takes as long whether or not the email exists.
        void mailer
          .send({
            to: request.body.email.trim(),
            subject: "Choose a new Star Chart password",
            text: [
              "Someone (hopefully you) asked to reset your Star Chart password.",
              "",
              "Choose a new one here:",
              `${config.appUrl}/reset-password.html#token=${encodeURIComponent(token)}`,
              "",
              "This link works once and expires in an hour. If you didn't ask, ignore this email.",
            ].join("\n"),
          })
          .catch((error: unknown) => request.log.error({ error }, "couldn't send a password reset email"));
      }
      return reply.code(204).send();
    },
  );

  app.post<{ Body: { token: string; password: string } }>(
    "/api/password-reset/complete",
    {
      schema: {
        body: {
          type: "object",
          properties: { token: { type: "string", minLength: 1, maxLength: 100 }, password: passwordField },
          required: ["token", "password"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (rateLimits.refuse(reply, [["wrongCodesPerAddress", request.ip]])) return reply;
      const session = await people.completePasswordReset(request.body.token, request.body.password);
      if (!session) rateLimits.count("wrongCodesPerAddress", request.ip);
      if (!session) return reply.code(404).send({ error: "That link has expired or was already used. Ask for a new one." });
      reply.setCookie(sessionCookie, session, cookieOptions);
      return {};
    },
  );

  app.post<{ Body: { grownUpId: string } }>(
    "/api/ownership",
    {
      schema: {
        body: {
          type: "object",
          properties: { grownUpId: { type: "string", maxLength: 36 } },
          required: ["grownUpId"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      if (signedIn.grownUp.role !== "owner") return reply.code(403).send({ error: "Only the owner can hand over the chart." });
      const result = await people.transferOwnership(signedIn.chart.id, signedIn.grownUp.id, request.body.grownUpId);
      if ("refused" in result) {
        if (result.refused === "not-an-admin") {
          return reply.code(409).send({ error: "Make them an admin first; ownership goes to an admin." });
        }
        return reply.code(404).send({ error: "no such grown-up" });
      }
      return {};
    },
  );

  app.delete<{ Params: { grownUpId: string } }>("/api/grown-ups/:grownUpId", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    const result = await people.remove(signedIn.chart.id, signedIn.grownUp, request.params.grownUpId);
    if ("refused" in result) {
      if (result.refused === "no-such-grown-up") return reply.code(404).send({ error: "no such grown-up" });
      if (result.refused === "is-yourself") {
        return reply.code(409).send({ error: "To leave the chart yourself, use Leave (the owner hands it over first)." });
      }
      return reply.code(403).send({
        error:
          signedIn.grownUp.role === "admin"
            ? "Admins can remove grown-ups, but only the owner can remove an admin."
            : "Only the owner and admins can remove grown-ups.",
      });
    }
    return reply.code(204).send();
  });

  app.delete("/api/me", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    const result = await people.leave(signedIn.grownUp);
    if ("refused" in result) {
      return reply.code(409).send({ error: "Hand the chart to an admin before leaving it." });
    }
    reply.clearCookie(sessionCookie, cookieOptions);
    return reply.code(204).send();
  });

  // Any grown-up can make a Guest PIN for a babysitter. The PIN is shown in this reply only.
  app.post<{ Body: { label?: string; hours?: number } }>(
    "/api/guest-pins",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            label: { type: "string", maxLength: 60 },
            hours: { type: "integer", minimum: 1, maximum: 72 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      const made = await people.guests.create({ chartId: signedIn.chart.id, createdBy: signedIn.grownUp.id, ...request.body });
      return reply.code(201).send({ id: made.id, pin: made.pin, expiresAt: made.expiresAt.toISOString() });
    },
  );

  app.get("/api/guest-pins", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    return { guestPins: await people.guests.list(signedIn.chart.id) };
  });

  app.delete<{ Params: { pinId: string } }>("/api/guest-pins/:pinId", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    if (!(await people.guests.cancel(signedIn.chart.id, request.params.pinId))) {
      return reply.code(404).send({ error: "no such Guest PIN" });
    }
    return reply.code(204).send();
  });

  app.patch<{ Body: { quizPoolTarget?: number } }>(
    "/api/chart",
    {
      schema: {
        body: {
          type: "object",
          properties: { quizPoolTarget: { type: "integer", minimum: 1, maximum: 50 } },
          minProperties: 1,
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      if (signedIn.grownUp.role === "grown-up") {
        return reply.code(403).send({ error: "Only the chart's owner and admins can change its settings." });
      }
      await people.changeChart(signedIn.chart.id, request.body);
      return {};
    },
  );

  app.post("/api/sign-out", async (request, reply) => {
    const token = request.cookies[sessionCookie];
    if (token) {
      await people.signOut(token);
      await people.guests.signOut(token);
    }
    reply.clearCookie(sessionCookie, cookieOptions);
    return reply.code(204).send();
  });

  app.get("/api/me", async (request, reply) => {
    const signedIn = await requireActor(people, request, reply);
    if (!signedIn) return reply;
    if (signedIn.kind === "guest") return { guest: true, chart: signedIn.chart };
    const { grownUp, chart } = signedIn;
    return { grownUp: { id: grownUp.id, email: grownUp.email, role: grownUp.role }, chart };
  });
}
