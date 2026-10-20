import { taskKind } from "../catalog/task-kinds.js";
import type { Clock } from "../clock.js";
import type { Database, DisplayStyle, TicketState } from "../database.js";
import { isId } from "../ids.js";
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
  | { result: "handed-in"; childNickname: string; title: string }
  | { result: "not-recognised" };

export interface TicketSummary {
  id: string;
  childId: string;
  childNickname: string;
  title: string;
  stars: number;
  state: TicketState;
}

/** The outcome of a grown-up's decision on a ticket. */
export type Decision<T> = T | { refused: "not-found" } | { refused: "not-allowed"; state: TicketState };

type GrownUpAction = "approve" | "reject" | "dismiss";

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
    ticketId: string,
    action: GrownUpAction,
    apply: (trx: Database, ticket: { id: string; child_id: string; stars: number }) => Promise<T>,
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
      return apply(trx, ticket);
    });
  }

  return {
    /**
     * Creates an open ticket for what a child chose at an observatory, and returns its print job.
     * Undefined if the child, category or choice isn't something this child can print in this chart.
     */
    async print(input: {
      chartId: string;
      observatoryId: string;
      childId: string;
      categoryId: string;
      choiceId: string;
    }): Promise<{ ticket: { id: string; state: TicketState }; job: PrintJob } | undefined> {
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
          .select("kind")
          .where("chart_id", "=", input.chartId)
          .where("id", "=", input.categoryId)
          .executeTakeFirst();
        if (!child || !category) return undefined;
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
          .executeTakeFirstOrThrow();
        return {
          ticket,
          job: {
            id: ticket.id,
            childNickname: child.nickname,
            displayStyle: child.display_style,
            title: issued.title,
            stars: issued.stars,
            code: issued.code,
          },
        };
      });
    },

    /** A child scanned a ticket's code at one of this chart's observatories. */
    async handIn(chartId: string, code: string): Promise<ScanResult> {
      const ticket = await db
        .updateTable("tickets")
        .set({ state: "handed-in" })
        .from("children")
        .whereRef("children.id", "=", "tickets.child_id")
        .where("tickets.chart_id", "=", chartId)
        .where("tickets.code", "=", code)
        .where("tickets.state", "=", "open")
        .returning(["children.nickname", "tickets.title"])
        .executeTakeFirst();
      if (!ticket) return { result: "not-recognised" };
      return { result: "handed-in", childNickname: ticket.nickname, title: ticket.title };
    },

    /**
     * A grown-up approves an open or handed-in ticket (a hand-in isn't required): it becomes Approved (final), and its
     * stars, or the grown-up's override, are added to the child's record.
     */
    async approve(
      chartId: string,
      ticketId: string,
      starsOverride?: number,
    ): Promise<Decision<{ id: string; state: TicketState; stars: number }>> {
      return decide(chartId, ticketId, "approve", async (trx, ticket) => {
        const awarded = starsOverride ?? ticket.stars;
        await trx
          .updateTable("tickets")
          .set({ state: "approved", awarded_stars: awarded })
          .where("id", "=", ticket.id)
          .execute();
        await stars.earnFromTicket(trx, { chartId, childId: ticket.child_id, ticketId: ticket.id, amount: awarded });
        return { id: ticket.id, state: "approved", stars: awarded };
      });
    },

    /** A grown-up decides a handed-in ticket isn't done yet: it goes back to Open, with an optional note, and earns no stars. */
    async reject(
      chartId: string,
      ticketId: string,
      note?: string,
    ): Promise<Decision<{ id: string; state: TicketState; note: string | null }>> {
      return decide(chartId, ticketId, "reject", async (trx, ticket) =>
        trx
          .updateTable("tickets")
          .set({ state: "open", note: note?.trim() || null })
          .where("id", "=", ticket.id)
          .returning(["id", "state", "note"])
          .executeTakeFirstOrThrow(),
      );
    },

    /**
     * A grown-up closes an open or handed-in ticket without stars, for example because it was lost or the chore
     * was already done by someone else.
     */
    async dismiss(chartId: string, ticketId: string): Promise<Decision<{ id: string; state: TicketState }>> {
      return decide(chartId, ticketId, "dismiss", async (trx, ticket) =>
        trx
          .updateTable("tickets")
          .set({ state: "dismissed" })
          .where("id", "=", ticket.id)
          .returning(["id", "state"])
          .executeTakeFirstOrThrow(),
      );
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
