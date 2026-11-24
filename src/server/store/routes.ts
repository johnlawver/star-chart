import type { FastifyInstance } from "fastify";
import type { ArtFiles } from "../art-files/art-files.js";
import { requireDevice } from "../observatories/authenticate-device.js";
import type { Observatories } from "../observatories/observatories.js";
import { requireGrownUp } from "../people/authenticate.js";
import type { People } from "../people/people.js";
import type { Store } from "./store.js";

const price = { type: "integer", minimum: 1, maximum: 10_000 };

export async function storeRoutes(app: FastifyInstance, people: People, observatories: Observatories, store: Store, artFiles: ArtFiles) {
  // The store as grown-ups manage it.
  app.get("/api/store-items", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    const [items, available] = await Promise.all([store.list(signedIn.chart.id), store.available(signedIn.chart.id)]);
    return { items, available };
  });

  // An owner or admin adds to the store: an item from the built-in list, or their own sticker with an uploaded picture.
  app.post<{ Body: { itemId: string; price?: number } | { name: string; price: number; artFileId: string } }>(
    "/api/store-items",
    {
      schema: {
        body: {
          oneOf: [
            {
              type: "object",
              properties: { itemId: { type: "string", minLength: 1, maxLength: 40 }, price },
              required: ["itemId"],
              additionalProperties: false,
            },
            {
              type: "object",
              properties: { name: { type: "string", minLength: 1, maxLength: 40, pattern: "\\S" }, price, artFileId: { type: "string", maxLength: 40 } },
              required: ["name", "price", "artFileId"],
              additionalProperties: false,
            },
          ],
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      if (signedIn.grownUp.role === "grown-up") return reply.code(403).send({ error: "Ask an admin to change the store." });
      const chartId = signedIn.chart.id;
      const body = request.body;
      if ("itemId" in body) {
        const added = await store.addBuiltIn(chartId, body.itemId, body.price);
        if (added === "unknown") return reply.code(400).send({ error: "that isn't one of the built-in items" });
        if (added === "already-in-store") return reply.code(409).send({ error: "that's already in the store" });
        return reply.code(201).send({ id: body.itemId });
      }
      if (!(await artFiles.belongsTo(chartId, body.artFileId))) return reply.code(404).send({ error: "no such picture" });
      return reply.code(201).send(await store.addSticker(chartId, { name: body.name.trim(), price: body.price, artFileId: body.artFileId }));
    },
  );

  // The chart's store, for the children's screen.
  app.get("/api/observatory/store", async (request, reply) => {
    const screen = await requireDevice(observatories, "screen", request, reply);
    if (!screen) return reply;
    return { items: await store.list(screen.chartId) };
  });

  // An owner or admin changes an item's price or picture.
  app.patch<{ Params: { itemId: string }; Body: { price?: number; artFileId?: string | null } }>(
    "/api/store-items/:itemId",
    {
      schema: {
        body: {
          type: "object",
          properties: { price, artFileId: { type: ["string", "null"], maxLength: 40 } },
          minProperties: 1,
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      if (signedIn.grownUp.role === "grown-up") return reply.code(403).send({ error: "Ask an admin to change the store." });
      const { artFileId } = request.body;
      if (typeof artFileId === "string" && !(await artFiles.belongsTo(signedIn.chart.id, artFileId))) {
        return reply.code(404).send({ error: "no such picture" });
      }
      const changed = await store.change(signedIn.chart.id, request.params.itemId, request.body);
      if (changed === "not-found") return reply.code(404).send({ error: "that isn't in the store" });
      if (changed === "needs-picture") return reply.code(400).send({ error: "an uploaded sticker needs a picture; replace it instead" });
      return { items: await store.list(signedIn.chart.id) };
    },
  );

  // A child dresses their mascot at the observatory: a hat and a hairstyle they own, or nothing.
  app.put<{ Params: { childId: string }; Body: { hat: string | null; hair: string | null } }>(
    "/api/observatory/children/:childId/mascot",
    {
      schema: {
        body: {
          type: "object",
          properties: { hat: { type: ["string", "null"], maxLength: 40 }, hair: { type: ["string", "null"], maxLength: 40 } },
          required: ["hat", "hair"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const screen = await requireDevice(observatories, "screen", request, reply);
      if (!screen) return reply;
      const dressed = await store.wear(screen.chartId, request.params.childId, request.body);
      if (dressed === "not-found") return reply.code(404).send({ error: "no such child" });
      if (dressed === "not-theirs") return reply.code(409).send({ error: "they can only wear outfits they own, each in its place" });
      return dressed;
    },
  );

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
