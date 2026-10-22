import type { Clock } from "../clock.js";
import type { Database, SampleSet, TaskKindName } from "../database.js";
import { isId } from "../ids.js";
import { allTaskKinds, type Choice } from "./task-kinds.js";

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
    /** Adds a category: an optional folder for tasks, which can hold chores and quizzes alike. */
    async addCategory(chartId: string, input: { name: string; icon?: string }) {
      return db
        .insertInto("task_categories")
        .values({ chart_id: chartId, name: input.name.trim(), kind: null, icon: input.icon ?? null, created_at: clock.now() })
        .returning(["id", "name", "icon"])
        .executeTakeFirstOrThrow();
    },

    /** Renames a category, or gives it a new icon (null for none). False if there's no such category in this chart. */
    async changeCategory(chartId: string, categoryId: string, changes: { name?: string; icon?: string | null }): Promise<boolean> {
      if (!isId(categoryId)) return false;
      const result = await db
        .updateTable("task_categories")
        .set({
          ...(changes.name === undefined ? {} : { name: changes.name.trim() }),
          ...(changes.icon === undefined ? {} : { icon: changes.icon }),
        })
        .where("chart_id", "=", chartId)
        .where("id", "=", categoryId)
        .executeTakeFirst();
      return result.numUpdatedRows > 0n;
    },

    /**
     * Removes a category. Its tasks stay, no longer in any category, and its tickets carry on (the database lets go
     * of the category rather than removing what was in it). False if there's no such category in this chart.
     */
    async removeCategory(chartId: string, categoryId: string): Promise<boolean> {
      if (!isId(categoryId)) return false;
      const result = await db
        .deleteFrom("task_categories")
        .where("chart_id", "=", chartId)
        .where("id", "=", categoryId)
        .executeTakeFirst();
      return result.numDeletedRows > 0n;
    },

    /**
     * Changes a chore: its name, stars, icon, frequency, category (null for none), or which children have it.
     * Tickets already printed keep what they were printed with. Refused if the chore, category or a child isn't in
     * this chart.
     */
    async changeChore(
      chartId: string,
      choreId: string,
      changes: {
        name?: string;
        stars?: number;
        icon?: string | null;
        frequency?: Frequency;
        categoryId?: string | null;
        childIds?: string[];
      },
    ): Promise<"changed" | "not-found" | "unknown-category-or-child"> {
      if (!isId(choreId)) return "not-found";
      return db.transaction().execute(async (trx) => {
        const chore = await trx
          .selectFrom("chores")
          .select("id")
          .where("chart_id", "=", chartId)
          .where("id", "=", choreId)
          .where("retired_at", "is", null)
          .executeTakeFirst();
        if (!chore) return "not-found" as const;
        if (!(await isCategoryIn(trx, chartId, changes.categoryId))) return "unknown-category-or-child" as const;
        if (changes.childIds && !(await areChildrenIn(trx, chartId, changes.childIds))) {
          return "unknown-category-or-child" as const;
        }
        const set = {
          ...(changes.name === undefined ? {} : { name: changes.name.trim() }),
          ...(changes.stars === undefined ? {} : { stars: changes.stars }),
          ...(changes.icon === undefined ? {} : { icon: changes.icon }),
          ...(changes.categoryId === undefined ? {} : { category_id: changes.categoryId }),
          ...(changes.frequency === undefined
            ? {}
            : { frequency_times: changes.frequency.times, frequency_per: changes.frequency.per }),
        };
        if (Object.keys(set).length > 0) await trx.updateTable("chores").set(set).where("id", "=", choreId).execute();
        if (changes.childIds) {
          await trx.deleteFrom("chore_assignments").where("chore_id", "=", choreId).execute();
          const childIds = [...new Set(changes.childIds)];
          if (childIds.length > 0) {
            await trx
              .insertInto("chore_assignments")
              .values(childIds.map((childId) => ({ chore_id: choreId, child_id: childId })))
              .execute();
          }
        }
        return "changed" as const;
      });
    },

    /** Changes a quiz topic: its name, stars, icon, built-in sample set or category (null for none of either). */
    async changeTopic(
      chartId: string,
      topicId: string,
      changes: { name?: string; stars?: number; icon?: string | null; samples?: SampleSet | null; categoryId?: string | null },
    ): Promise<"changed" | "not-found" | "unknown-category"> {
      if (!isId(topicId)) return "not-found";
      const topic = await db
        .selectFrom("topics")
        .select("id")
        .where("chart_id", "=", chartId)
        .where("id", "=", topicId)
        .where("retired_at", "is", null)
        .executeTakeFirst();
      if (!topic) return "not-found";
      if (!(await isCategoryIn(db, chartId, changes.categoryId))) return "unknown-category";
      const set = {
        ...(changes.name === undefined ? {} : { name: changes.name.trim() }),
        ...(changes.stars === undefined ? {} : { stars: changes.stars }),
        ...(changes.icon === undefined ? {} : { icon: changes.icon }),
        ...(changes.samples === undefined ? {} : { samples: changes.samples }),
        ...(changes.categoryId === undefined ? {} : { category_id: changes.categoryId }),
      };
      if (Object.keys(set).length > 0) await db.updateTable("topics").set(set).where("id", "=", topicId).execute();
      return "changed";
    },

    /**
     * Removes a chore or topic: it's no longer offered or listed, but it stays on record, so its tickets (even open
     * ones, which can still be handed in and approved), history and stars all still make sense.
     */
    async retire(chartId: string, kind: TaskKindName, taskId: string): Promise<boolean> {
      if (!isId(taskId)) return false;
      const result = await db
        .updateTable(kind === "chore" ? "chores" : "topics")
        .set({ retired_at: clock.now() })
        .where("chart_id", "=", chartId)
        .where("id", "=", taskId)
        .where("retired_at", "is", null)
        .executeTakeFirst();
      return result.numUpdatedRows > 0n;
    },

    /**
     * Adds a chore, assigned to some of the chart's children, and in a category if one is given.
     * Refused if the category or any child isn't in this chart.
     */
    async addChore(
      chartId: string,
      input: { categoryId?: string; name: string; stars: number; childIds: string[]; frequency?: Frequency; icon?: string },
    ): Promise<{ id: string; name: string; stars: number; icon: string | null } | { refused: string }> {
      if (!input.childIds.every(isId)) return { refused: "unknown category or child" };
      if (!(await isCategoryIn(db, chartId, input.categoryId))) return { refused: "unknown category or child" };
      return db.transaction().execute(async (trx) => {
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
            chart_id: chartId,
            category_id: input.categoryId ?? null,
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

    /**
     * The chart's categories, chores and topics for grown-ups. Tasks name their category (or none), so a category can
     * hold chores and quizzes alike. Removed (retired) tasks aren't listed.
     */
    async listForGrownUps(chartId: string) {
      const categories = await db
        .selectFrom("task_categories")
        .select(["id", "name", "icon"])
        .where("chart_id", "=", chartId)
        .orderBy("name")
        .execute();
      const choreRows = await db
        .selectFrom("chores")
        .leftJoin("chore_assignments", "chore_assignments.chore_id", "chores.id")
        .select([
          "chores.id",
          "chores.category_id",
          "chores.name",
          "chores.stars",
          "chores.icon",
          "chores.frequency_times",
          "chores.frequency_per",
          "chore_assignments.child_id",
        ])
        .where("chores.chart_id", "=", chartId)
        .where("chores.retired_at", "is", null)
        .orderBy("chores.name")
        .execute();
      const chores = new Map<
        string,
        {
          id: string;
          name: string;
          stars: number;
          icon: string | null;
          categoryId: string | null;
          frequency: Frequency;
          childIds: string[];
        }
      >();
      for (const row of choreRows) {
        const chore = chores.get(row.id) ?? {
          id: row.id,
          name: row.name,
          stars: row.stars,
          icon: row.icon,
          categoryId: row.category_id,
          frequency: { times: row.frequency_times, per: row.frequency_per },
          childIds: [],
        };
        if (row.child_id) chore.childIds.push(row.child_id);
        chores.set(row.id, chore);
      }
      const topicRows = await db
        .selectFrom("topics")
        .leftJoin("topic_children", "topic_children.topic_id", "topics.id")
        .select([
          "topics.id",
          "topics.category_id",
          "topics.name",
          "topics.stars",
          "topics.icon",
          "topics.samples",
          "topic_children.child_id",
          "topic_children.level",
        ])
        .where("topics.chart_id", "=", chartId)
        .where("topics.retired_at", "is", null)
        .orderBy("topics.name")
        .execute();
      const topics = new Map<
        string,
        {
          id: string;
          name: string;
          stars: number;
          icon: string | null;
          samples: SampleSet | null;
          categoryId: string | null;
          children: { childId: string; level: number }[];
        }
      >();
      for (const row of topicRows) {
        const topic = topics.get(row.id) ?? {
          id: row.id,
          name: row.name,
          stars: row.stars,
          icon: row.icon,
          samples: row.samples,
          categoryId: row.category_id,
          children: [],
        };
        if (row.child_id && row.level !== null) topic.children.push({ childId: row.child_id, level: row.level });
        topics.set(row.id, topic);
      }
      return { categories, chores: [...chores.values()], topics: [...topics.values()] };
    },

    /**
     * Adds a topic to a quiz category, optionally with a built-in sample set. Refused if the category isn't one of
     * this chart's quiz categories.
     */
    async addTopic(
      chartId: string,
      input: { categoryId?: string; name: string; stars: number; icon?: string; samples?: SampleSet },
    ): Promise<{ id: string; name: string; stars: number; icon: string | null; samples: SampleSet | null } | { refused: string }> {
      if (!(await isCategoryIn(db, chartId, input.categoryId))) return { refused: "unknown category" };
      return db
        .insertInto("topics")
        .values({
          chart_id: chartId,
          category_id: input.categoryId ?? null,
          name: input.name.trim(),
          stars: input.stars,
          icon: input.icon ?? null,
          samples: input.samples ?? null,
          created_at: clock.now(),
        })
        .returning(["id", "name", "stars", "icon", "samples"])
        .executeTakeFirstOrThrow();
    },

    /** Switches a topic on for a child at a level, or moves them to a new level. Refused if either isn't in this chart. */
    async setTopicLevel(chartId: string, topicId: string, childId: string, level: number): Promise<boolean> {
      if (!isId(topicId) || !isId(childId)) return false;
      const topic = await db
        .selectFrom("topics")
        .select("topics.id")
        .where("topics.chart_id", "=", chartId)
        .where("topics.id", "=", topicId)
        .executeTakeFirst();
      const child = await db
        .selectFrom("children")
        .select("id")
        .where("chart_id", "=", chartId)
        .where("id", "=", childId)
        .executeTakeFirst();
      if (!topic || !child) return false;
      await db
        .insertInto("topic_children")
        .values({ topic_id: topicId, child_id: childId, level })
        .onConflict((oc) => oc.columns(["topic_id", "child_id"]).doUpdateSet({ level }))
        .execute();
      return true;
    },

    /** Switches a topic off for a child. */
    async switchTopicOff(chartId: string, topicId: string, childId: string): Promise<boolean> {
      if (!isId(topicId) || !isId(childId)) return false;
      const result = await db
        .deleteFrom("topic_children")
        .where("topic_id", "=", topicId)
        .where("child_id", "=", childId)
        .where("child_id", "in", db.selectFrom("children").select("id").where("chart_id", "=", chartId))
        .executeTakeFirst();
      return result.numDeletedRows > 0n;
    },

    /**
     * What a child sees at the observatory: their categories (only those holding something they can choose), and the
     * tasks they can choose that aren't in any category.
     */
    async menuFor(chartId: string, childId: string) {
      if (!isId(childId)) return undefined;
      const child = await db
        .selectFrom("children")
        .select("id")
        .where("chart_id", "=", chartId)
        .where("id", "=", childId)
        .executeTakeFirst();
      if (!child) return undefined;
      const context = { now: clock.now(), timeZone: await timeZoneOf(db, chartId) };
      const choices = (await Promise.all(allTaskKinds.map((kind) => kind.choicesFor(db, context, childId))))
        .flat()
        .sort((a, b) => a.name.localeCompare(b.name));
      const categories = await db
        .selectFrom("task_categories")
        .select(["id", "name", "icon"])
        .where("chart_id", "=", chartId)
        .orderBy("name")
        .execute();
      const withoutCategory = ({ categoryId: _categoryId, ...choice }: Choice) => choice;
      return {
        categories: categories
          .map((category) => ({
            ...category,
            choices: choices.filter((choice) => choice.categoryId === category.id).map(withoutCategory),
          }))
          .filter((category) => category.choices.length > 0),
        tasks: choices.filter((choice) => choice.categoryId === null).map(withoutCategory),
      };
    },
  };
}

export type Catalog = ReturnType<typeof createCatalog>;

/** Whether every one of these children is in this chart. */
async function areChildrenIn(db: Database, chartId: string, childIds: string[]): Promise<boolean> {
  const unique = [...new Set(childIds)];
  if (unique.length === 0) return true;
  if (!unique.every(isId)) return false;
  const found = await db.selectFrom("children").select("id").where("chart_id", "=", chartId).where("id", "in", unique).execute();
  return found.length === unique.length;
}

/** Whether a category id (if one is given at all) is one of this chart's categories. */
async function isCategoryIn(db: Database, chartId: string, categoryId: string | null | undefined): Promise<boolean> {
  if (categoryId === undefined || categoryId === null) return true;
  if (!isId(categoryId)) return false;
  const category = await db
    .selectFrom("task_categories")
    .select("id")
    .where("chart_id", "=", chartId)
    .where("id", "=", categoryId)
    .executeTakeFirst();
  return category !== undefined;
}

/** A chart's time zone, which decides where its days and weeks begin. */
export async function timeZoneOf(db: Database, chartId: string): Promise<string> {
  const chart = await db.selectFrom("charts").select("time_zone").where("id", "=", chartId).executeTakeFirstOrThrow();
  return chart.time_zone;
}
