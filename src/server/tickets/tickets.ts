import { taskKind } from "../catalog/task-kinds.js";
import type { Clock } from "../clock.js";
import type { Database, DisplayStyle, TicketState } from "../database.js";
import { isId } from "../ids.js";

/** Everything a printer needs to print a ticket, independent of any printer's own format. */
export interface PrintJob {
  id: string;
  childNickname: string;
  displayStyle: DisplayStyle;
  title: string;
  stars: number;
  code: string;
}

/** The tickets module: printing tickets and (later) their whole lifecycle. */
export function createTickets(db: Database, clock: Clock) {
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
  };
}

export type Tickets = ReturnType<typeof createTickets>;
