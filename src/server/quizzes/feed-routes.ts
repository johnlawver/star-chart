import type { FastifyInstance } from "fastify";
import { requireGrownUp } from "../people/authenticate.js";
import type { People } from "../people/people.js";
import type { QuizItem } from "../database.js";
import { requireFeed, type QuizFeed } from "./feed.js";
import type { QuizPools } from "./quiz-pools.js";
import { quizBodyProperties } from "./routes.js";

export async function feedRoutes(app: FastifyInstance, people: People, feed: QuizFeed, quizPools: QuizPools) {
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

  // A quiz from the feed, for one child, topic and level. Its externalId (the feed's own id) makes resending safe.
  app.post<{
    Body: {
      childId: string;
      topicId: string;
      level: number;
      externalId: string;
      title: string;
      instructions: string;
      items: QuizItem[];
    };
  }>(
    "/api/feed/quizzes",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            ...quizBodyProperties,
            level: { type: "integer", minimum: 1, maximum: 20 },
            externalId: { type: "string", minLength: 1, maxLength: 100 },
          },
          required: ["childId", "topicId", "level", "externalId", "title", "instructions", "items"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const feedFor = await requireFeed(feed, request, reply);
      if (!feedFor) return reply;
      const result = await quizPools.add(feedFor.chartId, request.body);
      if ("refused" in result) return reply.code(400).send({ error: result.refused });
      return reply.code(result.duplicate ? 200 : 201).send({ quizId: result.id, ...(result.duplicate ? { duplicate: true } : {}) });
    },
  );

  app.get<{ Querystring: { after?: string } }>(
    "/api/feed/finished",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { after: { type: "string", pattern: "^[0-9]{1,18}$" } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const feedFor = await requireFeed(feed, request, reply);
      if (!feedFor) return reply;
      return feed.finished(feedFor.chartId, request.query.after);
    },
  );

  app.delete<{ Params: { externalId: string } }>("/api/feed/quizzes/:externalId", async (request, reply) => {
    const feedFor = await requireFeed(feed, request, reply);
    if (!feedFor) return reply;
    const outcome = await feed.withdraw(feedFor.chartId, request.params.externalId);
    if (outcome === "not-found") return reply.code(404).send({ error: "no quiz with that id" });
    if (outcome === "printed") return reply.code(409).send({ error: "that quiz has already been printed" });
    return reply.code(204).send();
  });
}
