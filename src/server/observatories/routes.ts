import type { Store } from "../store/store.js";
import type { FastifyInstance } from "fastify";
import { requireGrownUp, sessionCookie, sessionCookieOptions } from "../people/authenticate.js";
import type { Children } from "../people/children.js";
import type { People } from "../people/people.js";
import type { Role } from "../database.js";
import { requireDevice } from "./authenticate-device.js";
import { notPairedCloseCode, type LiveParts } from "./live-parts.js";
import type { Observatories } from "./observatories.js";
import type { Clock } from "../clock.js";
import { nextLocalHour } from "../time.js";
import type { RateLimits } from "../rate-limits.js";

/** Admins and the owner pair and unpair observatories and their parts; other grown-ups can't. */
function managesDevices(role: Role): boolean {
  return role === "owner" || role === "admin";
}

// The longest a Control Center unlocked on an observatory stays open, even if nobody closes it.
const unlockedSessionMs = 10 * 60 * 1000;

// The hour (in the chart's time zone) the screen reloads itself each night, when the family is asleep.
const nightlyReloadHour = 3;

// How long a newly opened connection has to say hello before it is closed.
const helloTimeoutMs = 10_000;

export async function observatoryRoutes(
  app: FastifyInstance,
  people: People,
  children: Children,
  observatories: Observatories,
  liveParts: LiveParts,
  store: Store,
  clock: Clock,
  rateLimits: RateLimits,
) {
  // Pairing an observatory's screen. The grown-up who signed in on it is then signed out,
  // so the children are never left in a grown-up's session.
  app.post("/api/observatories", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    if (!managesDevices(signedIn.grownUp.role)) {
      return reply.code(403).send({ error: "Ask an admin to set up this observatory." });
    }
    const { observatoryId, deviceToken } = await observatories.pair(signedIn.chart.id);
    const sessionToken = request.cookies[sessionCookie];
    if (sessionToken) await people.signOut(sessionToken);
    reply.clearCookie(sessionCookie, sessionCookieOptions);
    return reply.code(201).send({ observatory: { id: observatoryId }, deviceToken });
  });

  app.get("/api/observatories", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    const list = await observatories.list(signedIn.chart.id);
    return {
      observatories: list.map((observatory) => ({
        id: observatory.id,
        parts: observatory.parts.map((part) => ({ kind: part.kind, online: liveParts.isOnline(part.deviceId) })),
      })),
    };
  });

  app.delete<{ Params: { observatoryId: string } }>("/api/observatories/:observatoryId", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    if (!managesDevices(signedIn.grownUp.role)) {
      return reply.code(403).send({ error: "Only the chart's owner and admins can unpair an observatory." });
    }
    const { observatoryId } = request.params;
    if (!(await observatories.unpair(signedIn.chart.id, observatoryId))) {
      return reply.code(404).send({ error: "no such observatory" });
    }
    liveParts.disconnectObservatory(observatoryId);
    return reply.code(204).send();
  });

  // The screen asks about its own printer and scanner, so it can warn children when one is missing.
  app.get("/api/observatory/parts", async (request, reply) => {
    const screen = await requireDevice(observatories, "screen", request, reply);
    if (!screen) return reply;
    const parts = await observatories.partsOf(screen.observatoryId);
    const statusOf = (kind: "printer" | "scanner") => {
      const paired = parts.filter((part) => part.kind === kind);
      if (paired.length === 0) return "not-paired";
      return paired.some((part) => liveParts.isOnline(part.deviceId)) ? "online" : "offline";
    };
    return { printer: statusOf("printer"), scanner: statusOf("scanner") };
  });

  // The owner deletes the whole chart, typing its name to be sure. Lives here because its devices must be
  // disconnected straight away too.
  app.delete<{ Body: { confirmName: string } }>(
    "/api/chart",
    {
      schema: {
        body: {
          type: "object",
          properties: { confirmName: { type: "string", maxLength: 100 } },
          required: ["confirmName"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      if (signedIn.grownUp.role !== "owner") return reply.code(403).send({ error: "Only the owner can delete the chart." });
      if (request.body.confirmName.trim() !== signedIn.chart.name) {
        return reply.code(400).send({ error: "Type the chart's name exactly to delete it." });
      }
      await people.deleteChart(signedIn.chart.id);
      liveParts.disconnectChart(signedIn.chart.id);
      reply.clearCookie(sessionCookie, sessionCookieOptions);
      return reply.code(204).send();
    },
  );

  // The screen reloads itself once a night, to pick up a new release and start fresh. The server says when (3am in the
  // chart's time zone) and what time it is now, so a frame whose own clock is wrong still reloads at the right time.
  app.get("/api/observatory/schedule", async (request, reply) => {
    const screen = await requireDevice(observatories, "screen", request, reply);
    if (!screen) return reply;
    const now = clock.now();
    const nightlyReload = nextLocalHour(now, await people.timeZoneOf(screen.chartId), nightlyReloadHour);
    return { now: now.toISOString(), nightlyReload: nightlyReload.toISOString() };
  });

  // The grown-ups a screen offers for unlocking the Control Center: only those who have set a PIN.
  app.get("/api/observatory/grown-ups", async (request, reply) => {
    const screen = await requireDevice(observatories, "screen", request, reply);
    if (!screen) return reply;
    return { grownUps: await people.withPins(screen.chartId) };
  });

  // A grown-up unlocks the Control Center on a paired observatory with their PIN. Only paired screens can try,
  // so PINs can't be guessed from elsewhere.
  app.post<{ Body: { grownUpId: string; pin: string } }>(
    "/api/observatory/unlock",
    {
      schema: {
        body: {
          type: "object",
          properties: { grownUpId: { type: "string", maxLength: 36 }, pin: { type: "string", maxLength: 8 } },
          required: ["grownUpId", "pin"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const screen = await requireDevice(observatories, "screen", request, reply);
      if (!screen) return reply;
      if (await observatories.isPinLocked(screen.observatoryId)) {
        return reply.code(429).send({ error: "Too many wrong PINs. Try again in a few minutes." });
      }
      const token = await people.unlockWithPin({
        chartId: screen.chartId,
        grownUpId: request.body.grownUpId,
        pin: request.body.pin,
        lifetimeMs: unlockedSessionMs,
      });
      if (!token) {
        await observatories.wrongPin(screen.observatoryId);
        return reply.code(401).send({ error: "That PIN isn't right." });
      }
      await observatories.rightPin(screen.observatoryId);
      reply.setCookie(sessionCookie, token, sessionCookieOptions);
      return {};
    },
  );

  // A printer or scanner pairing code: the observatory's screen asks, with an admin or the owner unlocked on it.
  // A guest (a babysitter) unlocks the ticket-handling part of the Control Center with a Guest PIN. Wrong Guest PINs
  // count towards the same lockout as grown-up PINs.
  app.post<{ Body: { pin: string } }>(
    "/api/observatory/unlock-guest",
    {
      schema: {
        body: {
          type: "object",
          properties: { pin: { type: "string", maxLength: 8 } },
          required: ["pin"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const screen = await requireDevice(observatories, "screen", request, reply);
      if (!screen) return reply;
      if (await observatories.isPinLocked(screen.observatoryId)) {
        return reply.code(429).send({ error: "Too many wrong PINs. Try again in a few minutes." });
      }
      const token = await people.guests.unlock(screen.chartId, request.body.pin, unlockedSessionMs);
      if (!token) {
        await observatories.wrongPin(screen.observatoryId);
        return reply.code(401).send({ error: "That Guest PIN isn't right, or has expired." });
      }
      await observatories.rightPin(screen.observatoryId);
      reply.setCookie(sessionCookie, token, sessionCookieOptions);
      return {};
    },
  );

  app.post("/api/observatory/pairing-codes", async (request, reply) => {
    const screen = await requireDevice(observatories, "screen", request, reply);
    if (!screen) return reply;
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    if (signedIn.chart.id !== screen.chartId || !managesDevices(signedIn.grownUp.role)) {
      return reply.code(403).send({ error: "Ask an admin to pair a printer or scanner." });
    }
    return reply.code(201).send(await observatories.newPairingCode(screen.observatoryId));
  });

  app.post<{ Body: { code: string; kind: "printer" | "scanner" } }>(
    "/api/parts",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            code: { type: "string", minLength: 1, maxLength: 20 },
            kind: { type: "string", enum: ["printer", "scanner"] },
          },
          required: ["code", "kind"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (rateLimits.refuse(reply, [["wrongCodesPerAddress", request.ip]])) return reply;
      const paired = await observatories.pairPart(request.body.code, request.body.kind);
      if (!paired) rateLimits.count("wrongCodesPerAddress", request.ip);
      if (!paired) return reply.code(404).send({ error: "that pairing code isn't valid; ask for a new one" });
      return reply.code(201).send(paired);
    },
  );

  // Screens, printers and scanners connect out to the server here and keep the connection open (ADR 0003).
  // Their first message must be a hello carrying their credential; browsers can't send headers on a WebSocket.
  app.get("/api/parts/live", { websocket: true }, (socket, request) => {
    const timeout = setTimeout(() => socket.close(notPairedCloseCode, "no hello"), helloTimeoutMs);
    socket.once("message", async (data) => {
      clearTimeout(timeout);
      const hello = parseMessage(data);
      const device =
        hello?.type === "hello" && typeof hello.deviceToken === "string"
          ? await observatories.deviceFor(hello.deviceToken)
          : undefined;
      if (!device) {
        socket.close(notPairedCloseCode, "not a paired device");
        return;
      }
      liveParts.add(device, socket);
      socket.on("message", (later) => {
        const message = parseMessage(later);
        // Whatever goes wrong handling one message is logged; it must never take the server down.
        if (message) {
          liveParts
            .received(device, message)
            .catch((error: unknown) => request.log.error({ error }, "couldn't handle a device's message"));
        }
      });
      socket.send(JSON.stringify({ type: "welcome", kind: device.kind }));
    });
  });

  app.get("/api/observatory/children", async (request, reply) => {
    const screen = await requireDevice(observatories, "screen", request, reply);
    if (!screen) return reply;
    // Who are you: every child, with what their mascot is wearing, so their planet shows them dressed.
    const [list, wearing] = await Promise.all([children.list(screen.chartId), store.wearingByChild(screen.chartId)]);
    return { children: list.map((child) => ({ ...child, wearing: wearing.get(child.id) ?? { hat: null, hair: null } })) };
  });
}

function parseMessage(data: unknown): Record<string, unknown> | undefined {
  try {
    const message = JSON.parse(String(data));
    return typeof message === "object" && message !== null ? message : undefined;
  } catch {
    return undefined;
  }
}
