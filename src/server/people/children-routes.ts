import type { FastifyInstance } from "fastify";
import type { DisplayStyle } from "../database.js";
import { requireGrownUp } from "./authenticate.js";
import type { Children } from "./children.js";
import type { People } from "./people.js";

export async function childrenRoutes(app: FastifyInstance, people: People, children: Children) {
  app.get("/api/children", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    return { children: await children.list(signedIn.chart.id) };
  });

  app.post<{ Body: { nickname: string; displayStyle: DisplayStyle } }>("/api/children", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    const child = await children.add(signedIn.chart.id, request.body);
    return reply.code(201).send({ child });
  });

  app.patch<{ Params: { childId: string }; Body: { nickname?: string; displayStyle?: DisplayStyle } }>(
    "/api/children/:childId",
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      const child = await children.change(signedIn.chart.id, request.params.childId, request.body);
      if (!child) return reply.code(404).send({ error: "no such child" });
      return { child };
    },
  );

  app.delete<{ Params: { childId: string } }>("/api/children/:childId", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    if (!(await children.remove(signedIn.chart.id, request.params.childId))) {
      return reply.code(404).send({ error: "no such child" });
    }
    return reply.code(204).send();
  });
}
