import type { FastifyInstance } from "fastify";
import { requireGrownUp } from "../people/authenticate.js";
import type { People } from "../people/people.js";
import { requireFeed, type QuizFeed } from "./feed.js";

export async function feedRoutes(app: FastifyInstance, people: People, feed: QuizFeed) {
  // ----- Grown-ups manage Feed Keys (owners and admins only) -----

  app.post<{ Body: { label?: string } }>(
    "/api/feed-keys",
    {
      schema: {
        body: { type: "object", properties: { label: { type: "string", maxLength: 60 } }, additionalProperties: false },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      if (signedIn.grownUp.role === "grown-up") {
        return reply.code(403).send({ error: "Only the chart's owner and admins can make Feed Keys." });
      }
      return reply.code(201).send(await feed.makeKey(signedIn.chart.id, signedIn.grownUp.id, request.body.label));
    },
  );

  app.get("/api/feed-keys", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    return { feedKeys: await feed.listKeys(signedIn.chart.id) };
  });

  app.delete<{ Params: { keyId: string } }>("/api/feed-keys/:keyId", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    if (signedIn.grownUp.role === "grown-up") {
      return reply.code(403).send({ error: "Only the chart's owner and admins can revoke Feed Keys." });
    }
    if (!(await feed.revokeKey(signedIn.chart.id, request.params.keyId))) {
      return reply.code(404).send({ error: "no such Feed Key" });
    }
    return reply.code(204).send();
  });

  // ----- The quiz feed itself, with a Feed Key -----

  app.get("/api/feed/pools", async (request, reply) => {
    const feedFor = await requireFeed(feed, request, reply);
    if (!feedFor) return reply;
    return feed.pools(feedFor.chartId);
  });
}
