import type { FastifyInstance } from "fastify";
import type { SampleSet, TaskKindName } from "../database.js";
import { requireDevice } from "../observatories/authenticate-device.js";
import type { Observatories } from "../observatories/observatories.js";
import { requireGrownUp } from "../people/authenticate.js";
import type { People } from "../people/people.js";
import { iconLibrary } from "../icons/icons.js";
import type { Catalog, Frequency } from "./catalog.js";

const nameField = { type: "string", minLength: 1, maxLength: 60, pattern: "\\S" } as const;
const idField = { type: "string", maxLength: 36 } as const;
const iconField = { type: "string", maxLength: 40 } as const;
const unknownIcon = { error: "that icon isn't in the library" };

export async function catalogRoutes(app: FastifyInstance, people: People, observatories: Observatories, catalog: Catalog) {
  app.get("/api/categories", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    return { categories: await catalog.listForGrownUps(signedIn.chart.id) };
  });

  app.post<{ Body: { name: string; kind: TaskKindName; icon?: string } }>(
    "/api/categories",
    {
      schema: {
        body: {
          type: "object",
          properties: { name: nameField, kind: { type: "string", enum: ["chore", "quiz"] }, icon: iconField },
          required: ["name", "kind"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      if (request.body.icon !== undefined && !iconLibrary.has(request.body.icon)) return reply.code(400).send(unknownIcon);
      return reply.code(201).send({ category: await catalog.addCategory(signedIn.chart.id, request.body) });
    },
  );

  app.post<{
    Body: { categoryId: string; name: string; stars: number; childIds: string[]; frequency?: Frequency; icon?: string };
  }>(
    "/api/chores",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            categoryId: idField,
            name: nameField,
            stars: { type: "integer", minimum: 0, maximum: 100 },
            childIds: { type: "array", items: idField, maxItems: 100 },
            icon: iconField,
            frequency: {
              type: "object",
              properties: {
                times: { type: "integer", minimum: 1, maximum: 10 },
                per: { type: "string", enum: ["day", "week"] },
              },
              required: ["times", "per"],
              additionalProperties: false,
            },
          },
          required: ["categoryId", "name", "stars", "childIds"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      if (request.body.icon !== undefined && !iconLibrary.has(request.body.icon)) return reply.code(400).send(unknownIcon);
      const result = await catalog.addChore(signedIn.chart.id, request.body);
      if ("refused" in result) return reply.code(400).send({ error: result.refused });
      return reply.code(201).send({ chore: result });
    },
  );

  app.post<{
    Body: { categoryId: string; name: string; stars: number; icon?: string; samples?: SampleSet };
  }>(
    "/api/topics",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            categoryId: idField,
            name: nameField,
            stars: { type: "integer", minimum: 0, maximum: 100 },
            icon: iconField,
            samples: { type: "string", enum: ["addition", "subtraction", "letters", "numbers", "spelling"] },
          },
          required: ["categoryId", "name", "stars"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      if (request.body.icon !== undefined && !iconLibrary.has(request.body.icon)) return reply.code(400).send(unknownIcon);
      const result = await catalog.addTopic(signedIn.chart.id, request.body);
      if ("refused" in result) return reply.code(400).send({ error: result.refused });
      return reply.code(201).send({ topic: result });
    },
  );

  app.put<{ Params: { topicId: string; childId: string }; Body: { level: number } }>(
    "/api/topics/:topicId/children/:childId",
    {
      schema: {
        body: {
          type: "object",
          properties: { level: { type: "integer", minimum: 1, maximum: 20 } },
          required: ["level"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      const { topicId, childId } = request.params;
      if (!(await catalog.setTopicLevel(signedIn.chart.id, topicId, childId, request.body.level))) {
        return reply.code(404).send({ error: "no such topic or child" });
      }
      return reply.code(204).send();
    },
  );

  app.delete<{ Params: { topicId: string; childId: string } }>(
    "/api/topics/:topicId/children/:childId",
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      if (!(await catalog.switchTopicOff(signedIn.chart.id, request.params.topicId, request.params.childId))) {
        return reply.code(404).send({ error: "that topic isn't switched on for that child" });
      }
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { childId: string } }>("/api/observatory/children/:childId/menu", async (request, reply) => {
    const screen = await requireDevice(observatories, "screen", request, reply);
    if (!screen) return reply;
    const categories = await catalog.menuFor(screen.chartId, request.params.childId);
    if (!categories) return reply.code(404).send({ error: "no such child" });
    return { categories };
  });
}
