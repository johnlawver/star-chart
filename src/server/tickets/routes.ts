import type { FastifyInstance } from "fastify";
import { requireDevice } from "../observatories/authenticate-device.js";
import type { LiveParts } from "../observatories/live-parts.js";
import type { Observatories } from "../observatories/observatories.js";
import type { Tickets } from "./tickets.js";

const idField = { type: "string", maxLength: 36 } as const;

export async function ticketRoutes(
  app: FastifyInstance,
  observatories: Observatories,
  liveParts: LiveParts,
  tickets: Tickets,
) {
  // A child at an observatory chooses something to print.
  app.post<{ Params: { childId: string }; Body: { categoryId: string; choiceId: string } }>(
    "/api/observatory/children/:childId/tickets",
    {
      schema: {
        body: {
          type: "object",
          properties: { categoryId: idField, choiceId: idField },
          required: ["categoryId", "choiceId"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const screen = await requireDevice(observatories, "screen", request, reply);
      if (!screen) return reply;
      const printed = await tickets.print({
        chartId: screen.chartId,
        observatoryId: screen.observatoryId,
        childId: request.params.childId,
        ...request.body,
      });
      if (!printed) return reply.code(404).send({ error: "that isn't something this child can print" });
      liveParts.sendToPrinter(screen.observatoryId, { type: "print", ticket: printed.job });
      return reply.code(201).send({ ticket: printed.ticket });
    },
  );
}
