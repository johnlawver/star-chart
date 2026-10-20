import type { Clock } from "../clock.js";
import type { Database, TaskKindName } from "../database.js";
import { isId } from "../ids.js";
import { taskKind, type Choice } from "./task-kinds.js";

/** How often a chore can earn stars: so many times per day or per week. Once a day unless a grown-up says otherwise. */
export interface Frequency {
  times: number;
  per: "day" | "week";
}

export interface MenuCategory {
  id: string;
  name: string;
  kind: TaskKindName;
  icon: string | null;
  choices: Choice[];
}

/** The catalog module: task categories, chores, and what each child can choose. All scoped to one chart. */
export function createCatalog(db: Database, clock: Clock) {
  return {
    async addCategory(chartId: string, input: { name: string; kind: TaskKindName; icon?: string }) {
      return db
        .insertInto("task_categories")
        .values({ chart_id: chartId, name: input.name.trim(), kind: input.kind, icon: input.icon ?? null, created_at: clock.now() })
        .returning(["id", "name", "kind", "icon"])
        .executeTakeFirstOrThrow();
    },

    /**
     * Adds a chore to a chore category, assigned to some of the chart's children.
     * Refused if the category or any child isn't in this chart, or the category isn't for chores.
     */
    async addChore(
      chartId: string,
      input: { categoryId: string; name: string; stars: number; childIds: string[]; frequency?: Frequency; icon?: string },
    ): Promise<{ id: string; name: string; stars: number; icon: string | null } | { refused: string }> {
      if (!isId(input.categoryId) || !input.childIds.every(isId)) return { refused: "unknown category or child" };
      return db.transaction().execute(async (trx) => {
        const category = await trx
          .selectFrom("task_categories")
          .select("kind")
          .where("chart_id", "=", chartId)
          .where("id", "=", input.categoryId)
          .executeTakeFirst();
        if (!category) return { refused: "unknown category or child" };
        if (category.kind !== "chore") return { refused: "that category isn't for chores" };
        const childIds = [...new Set(input.childIds)];
        const children =
          childIds.length === 0
            ? []
            : await trx
                .selectFrom("children")
                .select("id")
                .where("chart_id", "=", chartId)
                .where("id", "in", childIds)
                .execute();
        if (children.length !== childIds.length) return { refused: "unknown category or child" };
        const chore = await trx
          .insertInto("chores")
          .values({
            category_id: input.categoryId,
            name: input.name.trim(),
            stars: input.stars,
            frequency_times: input.frequency?.times ?? 1,
            frequency_per: input.frequency?.per ?? "day",
            icon: input.icon ?? null,
            created_at: clock.now(),
          })
          .returning(["id", "name", "stars", "icon"])
          .executeTakeFirstOrThrow();
        if (childIds.length > 0) {
          await trx
            .insertInto("chore_assignments")
            .values(childIds.map((childId) => ({ chore_id: chore.id, child_id: childId })))
            .execute();
        }
        return chore;
      });
    },

    /** Every category in the chart with its chores and the children each chore is assigned to. */
    async listForGrownUps(chartId: string) {
      const categories = await db
        .selectFrom("task_categories")
        .select(["id", "name", "kind", "icon"])
        .where("chart_id", "=", chartId)
        .orderBy("name")
        .execute();
      const chores = await db
        .selectFrom("chores")
        .innerJoin("task_categories", "task_categories.id", "chores.category_id")
        .leftJoin("chore_assignments", "chore_assignments.chore_id", "chores.id")
        .select([
          "chores.id",
          "chores.category_id",
          "chores.name",
          "chores.stars",
          "chores.frequency_times",
          "chores.frequency_per",
          "chores.icon",
          "chore_assignments.child_id",
        ])
        .where("task_categories.chart_id", "=", chartId)
        .orderBy("chores.name")
        .execute();
      return categories.map((category) => {
        const byId = new Map<
          string,
          { id: string; name: string; stars: number; icon: string | null; frequency: Frequency; childIds: string[] }
        >();
        for (const row of chores.filter((chore) => chore.category_id === category.id)) {
          const chore = byId.get(row.id) ?? {
            id: row.id,
            name: row.name,
            stars: row.stars,
            icon: row.icon,
            frequency: { times: row.frequency_times, per: row.frequency_per },
            childIds: [],
          };
          if (row.child_id) chore.childIds.push(row.child_id);
          byId.set(row.id, chore);
        }
        return { ...category, chores: [...byId.values()] };
      });
    },

    /** The categories a child sees at the observatory: only those with something they can choose. */
    async menuFor(chartId: string, childId: string): Promise<MenuCategory[] | undefined> {
      if (!isId(childId)) return undefined;
      const child = await db
        .selectFrom("children")
        .select("id")
        .where("chart_id", "=", chartId)
        .where("id", "=", childId)
        .executeTakeFirst();
      if (!child) return undefined;
      const categories = await db
        .selectFrom("task_categories")
        .select(["id", "name", "kind", "icon"])
        .where("chart_id", "=", chartId)
        .orderBy("name")
        .execute();
      const context = { now: clock.now(), timeZone: await timeZoneOf(db, chartId) };
      const menu: MenuCategory[] = [];
      for (const category of categories) {
        const choices = await taskKind(category.kind).choicesFor(db, context, category.id, childId);
        if (choices.length > 0) menu.push({ ...category, choices });
      }
      return menu;
    },
  };
}

export type Catalog = ReturnType<typeof createCatalog>;

/** A chart's time zone, which decides where its days and weeks begin. */
export async function timeZoneOf(db: Database, chartId: string): Promise<string> {
  const chart = await db.selectFrom("charts").select("time_zone").where("id", "=", chartId).executeTakeFirstOrThrow();
  return chart.time_zone;
}
