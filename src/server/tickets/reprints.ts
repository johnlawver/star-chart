import type { Clock } from "../clock.js";
import type { Database } from "../database.js";
import { isUniqueViolation } from "../database-errors.js";
import { isId } from "../ids.js";
import type { PrintJob } from "./tickets.js";

class PrinterOffline extends Error {}

export interface PendingReprint {
  id: string;
  ticketId: string;
  childNickname: string;
  title: string;
  requestedAt: string;
}

/** Reprint requests: a child asks for a lost ticket again; a grown-up says yes (it prints) or no. */
export function createReprints(db: Database, clock: Clock) {
  return {
    /** A child at an observatory asks for their open ticket in a category to be printed again. */
    async request(input: {
      chartId: string;
      observatoryId: string;
      childId: string;
      categoryId: string;
    }): Promise<{ id: string; childNickname: string; title: string } | { refused: "no-open-ticket" | "already-asked" }> {
      if (!isId(input.childId) || !isId(input.categoryId)) return { refused: "no-open-ticket" };
      const ticket = await db
        .selectFrom("tickets")
        .innerJoin("children", "children.id", "tickets.child_id")
        .select(["tickets.id", "tickets.title", "children.nickname"])
        .where("tickets.chart_id", "=", input.chartId)
        .where("tickets.child_id", "=", input.childId)
        .where("tickets.category_id", "=", input.categoryId)
        .where("tickets.state", "=", "open")
        .executeTakeFirst();
      if (!ticket) return { refused: "no-open-ticket" };
      return db
        .insertInto("reprint_requests")
        .values({
          chart_id: input.chartId,
          ticket_id: ticket.id,
          observatory_id: input.observatoryId,
          state: "pending",
          created_at: clock.now(),
        })
        .returning("id")
        .executeTakeFirstOrThrow()
        .then((created) => ({ id: created.id, childNickname: ticket.nickname, title: ticket.title }))
        .catch((error: unknown) => {
          if (isUniqueViolation(error, "reprint_requests_one_pending")) return { refused: "already-asked" as const };
          throw error;
        });
    },

    /** The chart's requests waiting for a grown-up, oldest first. */
    async pending(chartId: string): Promise<PendingReprint[]> {
      const rows = await db
        .selectFrom("reprint_requests")
        .innerJoin("tickets", "tickets.id", "reprint_requests.ticket_id")
        .innerJoin("children", "children.id", "tickets.child_id")
        .select([
          "reprint_requests.id",
          "tickets.id as ticketId",
          "children.nickname as childNickname",
          "tickets.title",
          "reprint_requests.created_at",
        ])
        .where("reprint_requests.chart_id", "=", chartId)
        .where("reprint_requests.state", "=", "pending")
        .orderBy("reprint_requests.created_at")
        .execute();
      return rows.map(({ created_at, ...row }) => ({ ...row, requestedAt: created_at.toISOString() }));
    },

    /**
     * A grown-up says yes: the very same ticket (code, title, icon, stars) prints again on the observatory where the
     * child asked. If no printer takes it there, nothing changes and the request stays pending. If the ticket has
     * been finished in the meantime, the request is closed instead.
     */
    async approve(
      chartId: string,
      grownUpId: string,
      requestId: string,
      deliver: (observatoryId: string, job: PrintJob) => boolean,
    ): Promise<{ id: string } | { refused: "not-found" | "ticket-finished" | "printer-offline" }> {
      if (!isId(requestId)) return { refused: "not-found" };
      return db
        .transaction()
        .execute(async (trx) => {
          const request = await trx
            .selectFrom("reprint_requests")
            .innerJoin("tickets", "tickets.id", "reprint_requests.ticket_id")
            .innerJoin("children", "children.id", "tickets.child_id")
            .select([
              "reprint_requests.id",
              "reprint_requests.observatory_id",
              "tickets.id as ticketId",
              "tickets.state as ticketState",
              "tickets.title",
              "tickets.icon",
              "tickets.stars",
              "tickets.code",
              "children.nickname",
              "children.display_style",
            ])
            .where("reprint_requests.chart_id", "=", chartId)
            .where("reprint_requests.id", "=", requestId)
            .where("reprint_requests.state", "=", "pending")
            .forUpdate("reprint_requests")
            .executeTakeFirst();
          if (!request) return { refused: "not-found" as const };
          const decided = { decided_by_grown_up_id: grownUpId, decided_at: clock.now() };
          if (request.ticketState !== "open" || !request.observatory_id) {
            await trx.updateTable("reprint_requests").set({ state: "declined", ...decided }).where("id", "=", request.id).execute();
            return { refused: "ticket-finished" as const };
          }
          await trx.updateTable("reprint_requests").set({ state: "approved", ...decided }).where("id", "=", request.id).execute();
          const job: PrintJob = {
            id: request.ticketId,
            childNickname: request.nickname,
            displayStyle: request.display_style,
            title: request.title,
            icon: request.icon,
            stars: request.stars,
            code: request.code,
          };
          if (!deliver(request.observatory_id, job)) throw new PrinterOffline();
          return { id: request.id };
        })
        .catch((error: unknown) => {
          if (error instanceof PrinterOffline) return { refused: "printer-offline" as const };
          throw error;
        });
    },

    /** A grown-up says no: nothing prints. */
    async decline(chartId: string, grownUpId: string, requestId: string): Promise<boolean> {
      if (!isId(requestId)) return false;
      const result = await db
        .updateTable("reprint_requests")
        .set({ state: "declined", decided_by_grown_up_id: grownUpId, decided_at: clock.now() })
        .where("chart_id", "=", chartId)
        .where("id", "=", requestId)
        .where("state", "=", "pending")
        .executeTakeFirst();
      return result.numUpdatedRows > 0n;
    },
  };
}

export type Reprints = ReturnType<typeof createReprints>;
