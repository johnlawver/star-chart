import type { FastifyInstance } from "fastify";
import { requireDevice } from "../observatories/authenticate-device.js";
import type { Observatories } from "../observatories/observatories.js";
import { requireGrownUp } from "../people/authenticate.js";
import type { Children } from "../people/children.js";
import type { People } from "../people/people.js";
import type { Stars } from "./stars.js";

export async function starRoutes(
  app: FastifyInstance,
  people: People,
  observatories: Observatories,
  children: Children,
  stars: Stars,
) {
  // One child's view at the observatory, with their balance.
  app.get<{ Params: { childId: string } }>("/api/observatory/children/:childId", async (request, reply) => {
    const screen = await requireDevice(observatories, "screen", request, reply);
    if (!screen) return reply;
    const child = (await children.list(screen.chartId)).find((c) => c.id === request.params.childId);
    if (!child) return reply.code(404).send({ error: "no such child" });
    return { child: { ...child, balance: await stars.balance(screen.chartId, child.id) } };
  });

  app.get<{ Params: { childId: string } }>("/api/children/:childId/star-history", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    const history = await stars.history(signedIn.chart.id, request.params.childId);
    if (!history) return reply.code(404).send({ error: "no such child" });
    return history;
  });

  app.get<{ Params: { childId: string } }>(
    "/api/observatory/children/:childId/star-history",
    async (request, reply) => {
      const screen = await requireDevice(observatories, "screen", request, reply);
      if (!screen) return reply;
      const history = await stars.history(screen.chartId, request.params.childId);
      if (!history) return reply.code(404).send({ error: "no such child" });
      return history;
    },
  );

  app.post<{ Params: { childId: string }; Body: { amount: number; note: string } }>(
    "/api/children/:childId/redemptions",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            amount: { type: "integer", minimum: 1, maximum: 10_000 },
            note: { type: "string", minLength: 1, maxLength: 100, pattern: "\\S" },
          },
          required: ["amount", "note"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      const result = await stars.redeem({
        chartId: signedIn.chart.id,
        childId: request.params.childId,
        grownUpId: signedIn.grownUp.id,
        ...request.body,
      });
      if ("refused" in result) {
        if (result.refused === "no-such-child") return reply.code(404).send({ error: "no such child" });
        return reply
          .code(409)
          .send({ error: `Only ${result.balance} stars to spend`, balance: result.balance });
      }
      return reply.code(201).send(result);
    },
  );
}
