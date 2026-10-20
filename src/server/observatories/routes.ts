import type { FastifyInstance } from "fastify";
import { requireGrownUp, sessionCookie, sessionCookieOptions } from "../people/authenticate.js";
import type { Children } from "../people/children.js";
import type { People } from "../people/people.js";
import { requireDevice } from "./authenticate-device.js";
import { notPairedCloseCode, type LiveParts } from "./live-parts.js";
import type { Observatories } from "./observatories.js";

// How long a newly opened connection has to say hello before it is closed.
const helloTimeoutMs = 10_000;

export async function observatoryRoutes(
  app: FastifyInstance,
  people: People,
  children: Children,
  observatories: Observatories,
  liveParts: LiveParts,
) {
  // Pairing an observatory's screen. The grown-up who signed in on it is then signed out,
  // so the children are never left in a grown-up's session.
  app.post("/api/observatories", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    if (signedIn.grownUp.role !== "owner") {
      return reply.code(403).send({ error: "only the chart's owner can pair an observatory" });
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
    if (signedIn.grownUp.role !== "owner") {
      return reply.code(403).send({ error: "only the chart's owner can unpair an observatory" });
    }
    const { observatoryId } = request.params;
    if (!(await observatories.unpair(signedIn.chart.id, observatoryId))) {
      return reply.code(404).send({ error: "no such observatory" });
    }
    liveParts.disconnectObservatory(observatoryId);
    return reply.code(204).send();
  });

  app.post("/api/observatory/pairing-codes", async (request, reply) => {
    const screen = await requireDevice(observatories, "screen", request, reply);
    if (!screen) return reply;
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
      const paired = await observatories.pairPart(request.body.code, request.body.kind);
      if (!paired) return reply.code(404).send({ error: "that pairing code isn't valid; ask for a new one" });
      return reply.code(201).send(paired);
    },
  );

  // Screens, printers and scanners connect out to the server here and keep the connection open (ADR 0003).
  // Their first message must be a hello carrying their credential; browsers can't send headers on a WebSocket.
  app.get("/api/parts/live", { websocket: true }, (socket) => {
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
        if (message) void liveParts.received(device, message);
      });
      socket.send(JSON.stringify({ type: "welcome", kind: device.kind }));
    });
  });

  app.get("/api/observatory/children", async (request, reply) => {
    const screen = await requireDevice(observatories, "screen", request, reply);
    if (!screen) return reply;
    return { children: await children.list(screen.chartId) };
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
