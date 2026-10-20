import type { FastifyInstance } from "fastify";
import { requireGrownUp, sessionCookie, sessionCookieOptions } from "../people/authenticate.js";
import type { Children } from "../people/children.js";
import type { People } from "../people/people.js";
import { requireDevice } from "./authenticate-device.js";
import type { Observatories } from "./observatories.js";

export async function observatoryRoutes(
  app: FastifyInstance,
  people: People,
  children: Children,
  observatories: Observatories,
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
    return { observatories: await observatories.list(signedIn.chart.id) };
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

  app.get("/api/observatory/children", async (request, reply) => {
    const screen = await requireDevice(observatories, "screen", request, reply);
    if (!screen) return reply;
    return { children: await children.list(screen.chartId) };
  });
}
