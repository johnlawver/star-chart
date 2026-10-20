import { sql } from "kysely";
import type { Clock } from "../clock.js";
import type { Database } from "../database.js";

/** The stars module: an append-only record of every star each child earns or spends. */
export function createStars(db: Database, clock: Clock) {
  return {
    /** A child's balance: everything earned minus everything spent, always computed from the record. */
    async balance(chartId: string, childId: string): Promise<number> {
      const { total } = await db
        .selectFrom("star_movements")
        .select(sql<string>`coalesce(sum(amount), 0)`.as("total"))
        .where("chart_id", "=", chartId)
        .where("child_id", "=", childId)
        .executeTakeFirstOrThrow();
      return Number(total);
    },

    /** Records stars earned by approving a ticket. Pass the transaction the approval is part of. */
    async earnFromTicket(
      trx: Database,
      earned: { chartId: string; childId: string; ticketId: string; amount: number },
    ): Promise<void> {
      await trx
        .insertInto("star_movements")
        .values({
          chart_id: earned.chartId,
          child_id: earned.childId,
          ticket_id: earned.ticketId,
          amount: earned.amount,
          created_at: clock.now(),
        })
        .execute();
    },
  };
}

export type Stars = ReturnType<typeof createStars>;
