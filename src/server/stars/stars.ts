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

    /**
     * A child's star history: every star earned (with the task it was for) and spent (with what it was spent on),
     * newest first, with totals. Undefined if there's no such child in this chart.
     */
    async history(chartId: string, childId: string) {
      if (!isId(childId)) return undefined;
      const child = await db
        .selectFrom("children")
        .select("id")
        .where("chart_id", "=", chartId)
        .where("id", "=", childId)
        .executeTakeFirst();
      if (!child) return undefined;
      const movements = await db
        .selectFrom("star_movements")
        .leftJoin("tickets", "tickets.id", "star_movements.ticket_id")
        .select(["star_movements.amount", "star_movements.note", "tickets.title", "star_movements.created_at"])
        .where("star_movements.chart_id", "=", chartId)
        .where("star_movements.child_id", "=", childId)
        .orderBy("star_movements.seq", "desc")
        .execute();
      const entries = movements.map((movement) => ({
        kind: movement.amount < 0 ? ("spent" as const) : ("earned" as const),
        amount: Math.abs(movement.amount),
        what: movement.amount < 0 ? (movement.note ?? "") : (movement.title ?? "A task"),
        at: movement.created_at.toISOString(),
      }));
      const earned = entries.filter((e) => e.kind === "earned").reduce((sum, e) => sum + e.amount, 0);
      const spent = entries.filter((e) => e.kind === "spent").reduce((sum, e) => sum + e.amount, 0);
      return { earned, spent, balance: earned - spent, entries };
    },

    /**
     * A child's totals from the record: their balance (everything earned minus everything spent) and everything they've
     * ever earned, which spending never lowers.
     */
    async totals(chartId: string, childId: string): Promise<{ balance: number; earned: number }> {
      const { balance, earned } = await db
        .selectFrom("star_movements")
        .select([
          sql<string>`coalesce(sum(amount), 0)`.as("balance"),
          sql<string>`coalesce(sum(amount) filter (where amount > 0), 0)`.as("earned"),
        ])
        .where("chart_id", "=", chartId)
        .where("child_id", "=", childId)
        .executeTakeFirstOrThrow();
      return { balance: Number(balance), earned: Number(earned) };
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
