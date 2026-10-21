import type { FastifyInstance } from "fastify";
import { requireDevice } from "../observatories/authenticate-device.js";
import type { LiveParts } from "../observatories/live-parts.js";
import type { Observatories } from "../observatories/observatories.js";
import { decidedBy, requireActor } from "../people/authenticate.js";
import type { People } from "../people/people.js";
import type { Reprints } from "./reprints.js";
import type { Notifications } from "../notifications/notifications.js";

const idField = { type: "string", maxLength: 36 } as const;

export async function reprintRoutes(
  app: FastifyInstance,
  people: People,
  observatories: Observatories,
  liveParts: LiveParts,
  reprints: Reprints,
  notifications: Notifications,
) {
  // A child taps "I lost it" on a category where they hold an open ticket.
  app.post<{ Params: { childId: string }; Body: { categoryId: string } }>(
    "/api/observatory/children/:childId/reprint-requests",
    {
      schema: {
        body: {
          type: "object",
          properties: { categoryId: idField },
          required: ["categoryId"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const screen = await requireDevice(observatories, "screen", request, reply);
      if (!screen) return reply;
      const result = await reprints.request({
        chartId: screen.chartId,
        observatoryId: screen.observatoryId,
        childId: request.params.childId,
        categoryId: request.body.categoryId,
      });
      if ("refused" in result) {
        if (result.refused === "already-asked") {
          return reply.code(409).send({ error: "You already asked. A grown-up will check soon!" });
        }
        return reply.code(404).send({ error: "There's no ticket to print again here." });
      }
      void notifications
        .reprintRequested(screen.chartId, result)
        .catch((error: unknown) => request.log.error({ error }, "couldn't send a reprint notification"));
      return reply.code(201).send({ reprintRequest: { id: result.id } });
    },
  );

  app.get("/api/reprint-requests", async (request, reply) => {
    const signedIn = await requireActor(people, request, reply);
    if (!signedIn) return reply;
    return { reprintRequests: await reprints.pending(signedIn.chart.id) };
  });

  app.post<{ Params: { requestId: string } }>(
    "/api/reprint-requests/:requestId/approve",
    { schema: { body: { type: "object", additionalProperties: false } } },
    async (request, reply) => {
      const signedIn = await requireActor(people, request, reply);
      if (!signedIn) return reply;
      const result = await reprints.approve(signedIn.chart.id, decidedBy(signedIn), request.params.requestId, (observatoryId, job) =>
        liveParts.sendToPrinter(observatoryId, { type: "print", ticket: job }),
      );
      if ("refused" in result) {
        if (result.refused === "printer-offline") {
          return reply.code(503).send({ reason: "printer-offline", error: "That observatory's printer is offline. Try again when it's back." });
        }
        if (result.refused === "ticket-finished") {
          return reply.code(409).send({ error: "That ticket is already finished, so there's nothing to print again." });
        }
        return reply.code(404).send({ error: "no such reprint request waiting" });
      }
      return { reprintRequest: result };
    },
  );

  app.post<{ Params: { requestId: string } }>(
    "/api/reprint-requests/:requestId/decline",
    { schema: { body: { type: "object", additionalProperties: false } } },
    async (request, reply) => {
      const signedIn = await requireActor(people, request, reply);
      if (!signedIn) return reply;
      if (!(await reprints.decline(signedIn.chart.id, decidedBy(signedIn), request.params.requestId))) {
        return reply.code(404).send({ error: "no such reprint request waiting" });
      }
      return reply.code(204).send();
    },
  );
}
