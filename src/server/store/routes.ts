import type { FastifyInstance } from "fastify";
import { requireDevice } from "../observatories/authenticate-device.js";
import type { Observatories } from "../observatories/observatories.js";
import type { Store } from "./store.js";

export async function storeRoutes(app: FastifyInstance, observatories: Observatories, store: Store) {
  // The chart's store, for the children's screen.
  app.get("/api/observatory/store", async (request, reply) => {
    const screen = await requireDevice(observatories, "screen", request, reply);
    if (!screen) return reply;
    return { items: await store.list(screen.chartId) };
  });

  // A child buys something with their stars, at the observatory. No grown-up needed.
  app.post<{ Params: { childId: string }; Body: { storeItemId: string } }>(
    "/api/observatory/children/:childId/purchases",
    {
      schema: {
        body: {
          type: "object",
          properties: { storeItemId: { type: "string", minLength: 1, maxLength: 40 } },
          required: ["storeItemId"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const screen = await requireDevice(observatories, "screen", request, reply);
      if (!screen) return reply;
      const outcome = await store.buy(screen.chartId, request.params.childId, request.body.storeItemId);
      if (!("refused" in outcome)) return reply.code(201).send(outcome);
      if (outcome.refused === "not-found") return reply.code(404).send({ error: "no such child or store item" });
      if (outcome.refused === "already-owned") return reply.code(409).send({ error: "already owned" });
      return reply.code(409).send({ error: "not enough stars", balance: outcome.balance });
    },
  );
}
