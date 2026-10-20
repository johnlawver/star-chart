import { taskKind } from "../catalog/task-kinds.js";
import type { Clock } from "../clock.js";
import type { Database, DisplayStyle, TicketState } from "../database.js";
import { isId } from "../ids.js";
import { isUniqueViolation } from "../database-errors.js";
import type { Stars } from "../stars/stars.js";

/** Everything a printer needs to print a ticket, independent of any printer's own format. */
export interface PrintJob {
  id: string;
  childNickname: string;
  displayStyle: DisplayStyle;
  title: string;
  stars: number;
  code: string;
}

/** What happened when a ticket's code was scanned. */
export type ScanResult =
  | { result: "handed-in" | "waiting-for-grown-up" | "already-done"; childNickname: string; title: string }
  | { result: "not-recognised" };

export interface TicketSummary {
  id: string;
  childId: string;
  childNickname: string;
  title: string;
  stars: number;
  state: TicketState;
}

class PrinterOffline extends Error {}

/** The outcome of a grown-up's decision on a ticket. */
export type Decision<T> = T | { refused: "not-found" } | { refused: "not-allowed"; state: TicketState };

type GrownUpAction = "approve" | "reject" | "dismiss";

const recordedAs = { approve: "approved", reject: "rejected", dismiss: "dismissed" } as const;

/** Who is acting on a ticket. Guests join in ticket 15. */
export interface Actor {
  grownUpId: string;
}

/**
 * The states each grown-up action can be taken from. Approved and Dismissed appear nowhere: they're final.
 * A rejection only makes sense once a child has handed a ticket in.
 */
const allowedFrom: Record<GrownUpAction, TicketState[]> = {
  approve: ["open", "handed-in"],
  reject: ["handed-in"],
  dismiss: ["open", "handed-in"],
};

/** The tickets module: printing tickets and their whole lifecycle. */
export function createTickets(db: Database, clock: Clock, stars: Stars) {
  /**
   * Applies a grown-up's action to one of the chart's tickets, if its current state allows it. The ticket is locked
   * for the length of the transaction, so two grown-ups acting at once can't, say, award its stars twice.
   */
  async function decide<T>(
    chartId: string,
    actor: Actor,
    ticketId: string,
    action: GrownUpAction,
    apply: (
      trx: Database,
      ticket: { id: string; child_id: string; stars: number },
    ) => Promise<{ result: T; note?: string | null; stars?: number }>,
  ): Promise<Decision<T>> {
    if (!isId(ticketId)) return { refused: "not-found" };
    return db.transaction().execute(async (trx) => {
      const ticket = await trx
        .selectFrom("tickets")
        .select(["id", "child_id", "stars", "state"])
        .where("chart_id", "=", chartId)
        .where("id", "=", ticketId)
        .forUpdate()
        .executeTakeFirst();
      if (!ticket) return { refused: "not-found" as const };
      if (!allowedFrom[action].includes(ticket.state)) return { refused: "not-allowed" as const, state: ticket.state };
      const applied = await apply(trx, ticket);
      await trx
        .insertInto("ticket_events")
        .values({
          ticket_id: ticket.id,
          action: recordedAs[action],
          grown_up_id: actor.grownUpId,
          note: applied.note ?? null,
          stars: applied.stars ?? null,
          created_at: clock.now(),
        })
        .execute();
      return applied.result;
    });
  }

  return {
    /**
     * Creates an open ticket for what a child chose at an observatory, and returns its print job.
     * Undefined if the child, category or choice isn't something this child can print in this chart.
     */
    async print(
      input: {
        chartId: string;
        observatoryId: string;
        childId: string;
        categoryId: string;
        choiceId: string;
      },
      /** Hands the print job to the observatory's printer. Returns false if no printer is there to take it. */
      deliver: (job: PrintJob) => boolean,
    ): Promise<
      | { ticket: { id: string; state: TicketState }; job: PrintJob }
      | { refused: "already-holding"; category: string }
      | { refused: "printer-offline" }
      | undefined
    > {
      if (!isId(input.childId) || !isId(input.categoryId)) return undefined;
      return db.transaction().execute(async (trx) => {
        const child = await trx
          .selectFrom("children")
          .select(["nickname", "display_style"])
          .where("chart_id", "=", input.chartId)
          .where("id", "=", input.childId)
          .executeTakeFirst();
        const category = await trx
          .selectFrom("task_categories")
          .select(["kind", "name"])
          .where("chart_id", "=", input.chartId)
          .where("id", "=", input.categoryId)
          .executeTakeFirst();
        if (!child || !category) return undefined;
        const alreadyHolding = await trx
          .selectFrom("tickets")
          .select("id")
          .where("child_id", "=", input.childId)
          .where("category_id", "=", input.categoryId)
          .where("state", "in", ["open", "handed-in"])
          .executeTakeFirst();
        if (alreadyHolding) return { refused: "already-holding" as const, category: category.name };
        const issued = await taskKind(category.kind).issue(trx, input.categoryId, input.childId, input.choiceId);
        if (!issued) return undefined;
        const ticket = await trx
          .insertInto("tickets")
          .values({
            chart_id: input.chartId,
            child_id: input.childId,
            category_id: input.categoryId,
            chore_id: issued.choreId,
            code: issued.code,
            title: issued.title,
            stars: issued.stars,
            state: "open",
            printed_by_observatory_id: input.observatoryId,
            created_at: clock.now(),
          })
          .returning(["id", "state"])
          .executeTakeFirstOrThrow()
          .catch((error: unknown) => {
            // Another print for this child and category won the race between the check above and this insert.
            if (isUniqueViolation(error, "tickets_one_open_per_category")) return undefined;
            throw error;
          });
        if (!ticket) return { refused: "already-holding" as const, category: category.name };
        const job: PrintJob = {
          id: ticket.id,
          childNickname: child.nickname,
          displayStyle: child.display_style,
          title: issued.title,
          stars: issued.stars,
          code: issued.code,
        };
        // No printer, no ticket: roll the whole print back rather than leave a ticket nobody can hold.
        if (!deliver(job)) throw new PrinterOffline();
        return { ticket, job };
      }).catch((error: unknown) => {
        if (error instanceof PrinterOffline) return { refused: "printer-offline" as const };
        throw error;
      });
    },

    /**
     * A child scanned a ticket's code at one of this chart's observatories. A chore's code is shared by every printing
     * for that child (ADR 0001), so the scan counts towards the child's current open ticket with that code, if any.
     */
    async handIn(chartId: string, code: string): Promise<ScanResult> {
      return db.transaction().execute(async (trx) => {
        const withCode = await trx
          .selectFrom("tickets")
          .innerJoin("children", "children.id", "tickets.child_id")
          .select(["tickets.id", "tickets.state", "tickets.title", "children.nickname"])
          .where("tickets.chart_id", "=", chartId)
          .where("tickets.code", "=", code)
          .orderBy("tickets.created_at", "desc")
          .forUpdate("tickets")
          .execute();
        const latest = withCode[0];
        if (!latest) return { result: "not-recognised" as const };
        const about = { childNickname: latest.nickname, title: latest.title };
        const open = withCode.find((ticket) => ticket.state === "open");
        if (open) {
          await trx.updateTable("tickets").set({ state: "handed-in" }).where("id", "=", open.id).execute();
          return { result: "handed-in" as const, ...about };
        }
        if (withCode.some((ticket) => ticket.state === "handed-in")) {
          return { result: "waiting-for-grown-up" as const, ...about };
        }
        return { result: "already-done" as const, ...about };
      });
    },

    /**
     * A grown-up approves an open or handed-in ticket (a hand-in isn't required): it becomes Approved (final), and its
     * stars, or the grown-up's override, are added to the child's record.
     */
    async approve(
      chartId: string,
      actor: Actor,
      ticketId: string,
      starsOverride?: number,
    ): Promise<Decision<{ id: string; state: TicketState; stars: number }>> {
      return decide(chartId, actor, ticketId, "approve", async (trx, ticket) => {
        const awarded = starsOverride ?? ticket.stars;
        await trx
          .updateTable("tickets")
          .set({ state: "approved", awarded_stars: awarded })
          .where("id", "=", ticket.id)
          .execute();
        await stars.earnFromTicket(trx, { chartId, childId: ticket.child_id, ticketId: ticket.id, amount: awarded });
        return { result: { id: ticket.id, state: "approved" as const, stars: awarded }, stars: awarded };
      });
    },

    /** A grown-up decides a handed-in ticket isn't done yet: it goes back to Open, with an optional note, and earns no stars. */
    async reject(
      chartId: string,
      actor: Actor,
      ticketId: string,
      note?: string,
    ): Promise<Decision<{ id: string; state: TicketState; note: string | null }>> {
      return decide(chartId, actor, ticketId, "reject", async (trx, ticket) => {
        const result = await trx
          .updateTable("tickets")
          .set({ state: "open", note: note?.trim() || null })
          .where("id", "=", ticket.id)
          .returning(["id", "state", "note"])
          .executeTakeFirstOrThrow();
        return { result, note: result.note };
      });
    },

    /**
     * A grown-up closes an open or handed-in ticket without stars, for example because it was lost or the chore
     * was already done by someone else.
     */
    async dismiss(chartId: string, actor: Actor, ticketId: string): Promise<Decision<{ id: string; state: TicketState }>> {
      return decide(chartId, actor, ticketId, "dismiss", async (trx, ticket) => ({
        result: await trx
          .updateTable("tickets")
          .set({ state: "dismissed" })
          .where("id", "=", ticket.id)
          .returning(["id", "state"])
          .executeTakeFirstOrThrow(),
      }));
    },

    /** What grown-ups have done to one of the chart's tickets, oldest first. Undefined if there's no such ticket. */
    async history(chartId: string, ticketId: string) {
      if (!isId(ticketId)) return undefined;
      const ticket = await db
        .selectFrom("tickets")
        .select("id")
        .where("chart_id", "=", chartId)
        .where("id", "=", ticketId)
        .executeTakeFirst();
      if (!ticket) return undefined;
      const events = await db
        .selectFrom("ticket_events")
        .leftJoin("grown_ups", "grown_ups.id", "ticket_events.grown_up_id")
        .select([
          "ticket_events.action",
          "grown_ups.email",
          "ticket_events.note",
          "ticket_events.stars",
          "ticket_events.created_at",
        ])
        .where("ticket_events.ticket_id", "=", ticket.id)
        .orderBy("ticket_events.seq")
        .execute();
      return events.map((event) => ({
        action: event.action,
        by: event.email ?? "a former grown-up",
        note: event.note,
        stars: event.stars,
        at: event.created_at.toISOString(),
      }));
    },

    /** The chart's tickets in a given state, oldest first, for grown-ups to work through. */
    async list(chartId: string, state: TicketState): Promise<TicketSummary[]> {
      return db
        .selectFrom("tickets")
        .innerJoin("children", "children.id", "tickets.child_id")
        .select([
          "tickets.id",
          "tickets.child_id as childId",
          "children.nickname as childNickname",
          "tickets.title",
          "tickets.stars",
          "tickets.state",
        ])
        .where("tickets.chart_id", "=", chartId)
        .where("tickets.state", "=", state)
        .orderBy("tickets.created_at")
        .execute();
    },
  };
}

export type Tickets = ReturnType<typeof createTickets>;
