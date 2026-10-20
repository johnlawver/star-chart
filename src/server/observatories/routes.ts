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

  app.get("/api/observatory/children", async (request, reply) => {
    const screen = await requireDevice(observatories, "screen", request, reply);
    if (!screen) return reply;
    return { children: await children.list(screen.chartId) };
  });
}
