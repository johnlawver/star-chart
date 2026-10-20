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
          nickname: input.nickname,
          display_style: input.displayStyle,
          created_at: clock.now(),
        })
        .returning(["id", "nickname", "display_style as displayStyle"])
        .executeTakeFirstOrThrow();
    },
  };
}

export type Children = ReturnType<typeof createChildren>;
