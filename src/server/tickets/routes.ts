import type { FastifyInstance } from "fastify";
import { requireDevice } from "../observatories/authenticate-device.js";
import type { LiveParts } from "../observatories/live-parts.js";
import type { Observatories } from "../observatories/observatories.js";
import { requireGrownUp } from "../people/authenticate.js";
import type { People } from "../people/people.js";
import type { TicketState } from "../database.js";
import type { Tickets } from "./tickets.js";

const idField = { type: "string", maxLength: 36 } as const;

export async function ticketRoutes(
  app: FastifyInstance,
  people: People,
  observatories: Observatories,
  liveParts: LiveParts,
  tickets: Tickets,
) {
  // A scanner read a ticket's code: hand it in, and tell the observatory's screen (and the scanner) what happened.
  liveParts.on("scan", async (device, message) => {
    if (device.kind !== "scanner" || typeof message.code !== "string") return;
    const outcome = await tickets.handIn(device.chartId, message.code.trim());
    const result = { type: "scan-result", ...outcome };
    liveParts.sendTo(device.observatoryId, "screen", result);
    liveParts.sendTo(device.observatoryId, "scanner", result);
  });

  app.get<{ Querystring: { state: TicketState } }>(
    "/api/tickets",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { state: { type: "string", enum: ["open", "handed-in", "approved", "dismissed"] } },
          required: ["state"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      return { tickets: await tickets.list(signedIn.chart.id, request.query.state) };
    },
  );

  app.post<{ Params: { ticketId: string }; Body: { stars?: number } }>(
    "/api/tickets/:ticketId/approve",
    {
      schema: {
        body: {
          type: "object",
          properties: { stars: { type: "integer", minimum: 0, maximum: 100 } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      const ticket = await tickets.approve(signedIn.chart.id, request.params.ticketId, request.body.stars);
      if (!ticket) return reply.code(404).send({ error: "no handed-in ticket like that" });
      return { ticket };
    },
  );

  app.post<{ Params: { ticketId: string }; Body: { note?: string } }>(
    "/api/tickets/:ticketId/reject",
    {
      schema: {
        body: {
          type: "object",
          properties: { note: { type: "string", maxLength: 200 } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      const ticket = await tickets.reject(signedIn.chart.id, request.params.ticketId, request.body.note);
      if (!ticket) return reply.code(404).send({ error: "no handed-in ticket like that" });
      return { ticket };
    },
  );

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
