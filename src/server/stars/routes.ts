import type { FastifyInstance } from "fastify";
import { requireDevice } from "../observatories/authenticate-device.js";
import type { Observatories } from "../observatories/observatories.js";
import type { Children } from "../people/children.js";
import type { Stars } from "./stars.js";

export async function starRoutes(app: FastifyInstance, observatories: Observatories, children: Children, stars: Stars) {
  // One child's view at the observatory, with their balance.
  app.get<{ Params: { childId: string } }>("/api/observatory/children/:childId", async (request, reply) => {
    const screen = await requireDevice(observatories, "screen", request, reply);
    if (!screen) return reply;
    const child = (await children.list(screen.chartId)).find((c) => c.id === request.params.childId);
    if (!child) return reply.code(404).send({ error: "no such child" });
    return { child: { ...child, balance: await stars.balance(screen.chartId, child.id) } };
  });
}
