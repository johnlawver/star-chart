import { sql } from "kysely";
import type { Clock } from "../clock.js";
import type { Database } from "../database.js";
import { isId } from "../ids.js";

/** The stars module: an append-only record of every star each child earns or spends. */
export function createStars(db: Database, clock: Clock) {
  async function balanceIn(trx: Database, chartId: string, childId: string): Promise<number> {
    const { total } = await trx
      .selectFrom("star_movements")
      .select(sql<string>`coalesce(sum(amount), 0)`.as("total"))
      .where("chart_id", "=", chartId)
      .where("child_id", "=", childId)
      .executeTakeFirstOrThrow();
    return Number(total);
  }

  return {
    /**
     * A grown-up records that a child spent stars. Refused if it would take the balance below zero.
     * The child is locked while the balance is checked, so two redemptions at once can't overspend.
     */
    async redeem(input: {
      chartId: string;
      childId: string;
      amount: number;
      note: string;
      grownUpId: string;
    }): Promise<{ balance: number } | { refused: "no-such-child" } | { refused: "not-enough-stars"; balance: number }> {
      if (!isId(input.childId)) return { refused: "no-such-child" };
      return db.transaction().execute(async (trx) => {
        const child = await trx
          .selectFrom("children")
          .select("id")
          .where("chart_id", "=", input.chartId)
          .where("id", "=", input.childId)
          .forUpdate()
          .executeTakeFirst();
        if (!child) return { refused: "no-such-child" as const };
        const balance = await balanceIn(trx, input.chartId, input.childId);
        if (input.amount > balance) return { refused: "not-enough-stars" as const, balance };
        await trx
          .insertInto("star_movements")
          .values({
            chart_id: input.chartId,
            child_id: input.childId,
            amount: -input.amount,
            ticket_id: null,
            note: input.note.trim(),
            recorded_by_grown_up_id: input.grownUpId,
            created_at: clock.now(),
          })
          .execute();
        return { balance: balance - input.amount };
      });
    },

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
          note: null,
          recorded_by_grown_up_id: null,
          created_at: clock.now(),
        })
        .execute();
    },
  };
}

export type Stars = ReturnType<typeof createStars>;
