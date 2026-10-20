import type { FastifyInstance } from "fastify";
import type { TaskKindName } from "../database.js";
import { requireDevice } from "../observatories/authenticate-device.js";
import type { Observatories } from "../observatories/observatories.js";
import { requireGrownUp } from "../people/authenticate.js";
import type { People } from "../people/people.js";
import type { Catalog } from "./catalog.js";

const nameField = { type: "string", minLength: 1, maxLength: 60, pattern: "\\S" } as const;
const idField = { type: "string", maxLength: 36 } as const;

export async function catalogRoutes(app: FastifyInstance, people: People, observatories: Observatories, catalog: Catalog) {
  app.get("/api/categories", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    return { categories: await catalog.listForGrownUps(signedIn.chart.id) };
  });

  app.post<{ Body: { name: string; kind: TaskKindName } }>(
    "/api/categories",
    {
      schema: {
        body: {
          type: "object",
          // Only chores for now; quizzes arrive in ticket 10.
          properties: { name: nameField, kind: { type: "string", enum: ["chore"] } },
          required: ["name", "kind"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      return reply.code(201).send({ category: await catalog.addCategory(signedIn.chart.id, request.body) });
    },
  );

  app.post<{ Body: { categoryId: string; name: string; stars: number; childIds: string[] } }>(
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
          },
          required: ["categoryId", "name", "stars", "childIds"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      const result = await catalog.addChore(signedIn.chart.id, request.body);
      if ("refused" in result) return reply.code(400).send({ error: result.refused });
      return reply.code(201).send({ chore: result });
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
