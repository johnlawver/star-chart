import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../app.js";
import { requireGrownUp, sessionCookie, sessionCookieOptions as cookieOptions } from "./authenticate.js";
import type { People } from "./people.js";
import type { Mailer } from "../email.js";

// A password needs to be at least this long.
const passwordField = { type: "string", minLength: 8, maxLength: 200 } as const;

export async function peopleRoutes(app: FastifyInstance, people: People, config: AppConfig, mailer: Mailer) {
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
    const token = await people.signIn(request.body);
    if (!token) return reply.code(401).send({ error: "email or password is wrong" });
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
      const token = await people.claimPhoneSetupCode(request.body.code);
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
      const result = await people.acceptInvitation(request.body.token, request.body.password);
      if ("refused" in result) {
        if (result.refused === "email-in-use") {
          return reply.code(409).send({ error: "That email already belongs to a chart. Ask for an invitation to another email." });
        }
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
      const session = await people.completePasswordReset(request.body.token, request.body.password);
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

  app.post("/api/sign-out", async (request, reply) => {
    const token = request.cookies[sessionCookie];
    if (token) await people.signOut(token);
    reply.clearCookie(sessionCookie, cookieOptions);
    return reply.code(204).send();
  });

  app.get("/api/me", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    const { grownUp, chart } = signedIn;
    return { grownUp: { id: grownUp.id, email: grownUp.email, role: grownUp.role }, chart };
  });
}
