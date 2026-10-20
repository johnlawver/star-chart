import type { Clock } from "../clock.js";
import type { Database, DisplayStyle } from "../database.js";

export interface Child {
  id: string;
  nickname: string;
  displayStyle: DisplayStyle;
}

/** Children within one chart. Every operation is scoped to the chart it's given. */
export function createChildren(db: Database, clock: Clock) {
  return {
    async list(chartId: string): Promise<Child[]> {
      return db
        .selectFrom("children")
        .select(["id", "nickname", "display_style as displayStyle"])
        .where("chart_id", "=", chartId)
        .orderBy("nickname")
        .execute();
    },

    async add(chartId: string, input: { nickname: string; displayStyle: DisplayStyle }): Promise<Child> {
      return db
        .insertInto("children")
        .values({
          chart_id: chartId,
          nickname: input.nickname.trim(),
          display_style: input.displayStyle,
          created_at: clock.now(),
        })
        .returning(["id", "nickname", "display_style as displayStyle"])
        .executeTakeFirstOrThrow();
    },

    /** Changes a child's nickname or display style. Undefined if there's no such child in this chart. */
    async change(
      chartId: string,
      childId: string,
      changes: { nickname?: string; displayStyle?: DisplayStyle },
    ): Promise<Child | undefined> {
      return db
        .updateTable("children")
        .set({
          ...(changes.nickname === undefined ? {} : { nickname: changes.nickname.trim() }),
          ...(changes.displayStyle === undefined ? {} : { display_style: changes.displayStyle }),
        })
        .where("chart_id", "=", chartId)
        .where("id", "=", childId)
        .returning(["id", "nickname", "display_style as displayStyle"])
        .executeTakeFirst();
    },

    /**
     * Removes a child and, through the database's cascading deletes, everything that belongs to them.
     * Returns false if there's no such child in this chart.
     */
    async remove(chartId: string, childId: string): Promise<boolean> {
      const result = await db
        .deleteFrom("children")
        .where("chart_id", "=", chartId)
        .where("id", "=", childId)
        .executeTakeFirst();
      return result.numDeletedRows > 0n;
    },
  };
}

export type Children = ReturnType<typeof createChildren>;
