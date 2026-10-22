import { sql } from "kysely";
import type { Database, TaskKindName } from "../database.js";
import { isId } from "../ids.js";
import { startOfPeriod } from "../time.js";
import { newTicketCode } from "../tokens.js";
import { addQuiz } from "../quizzes/quiz-pools.js";
import { sampleQuiz } from "../quizzes/samples.js";

/** Something a child can pick at the observatory, such as one chore or one quiz topic. */
export interface Choice {
  kind: TaskKindName;
  id: string;
  name: string;
  stars: number;
  icon: string | null;
  /** The category it's filed in, if any: categories are optional folders. */
  categoryId: string | null;
  /** Already done as often as it can earn stars for now (for example, once today), so it can't be printed. */
  done: boolean;
}

/** What goes on a ticket when a child chooses something. */
export interface IssuedTask {
  title: string;
  /** The category the task is filed in, if any, kept on the ticket for the record. */
  categoryId: string | null;
  icon: string | null;
  stars: number;
  code: string;
  choreId: string | null;
  /** For a quiz: which quiz and topic, and what's printed (instructions and prompts, never the answers). */
  quizId?: string;
  topicId?: string;
  quiz?: { instructions: string; prompts: string[] };
  /** For a quiz: the topic's name, and anything grown-ups should hear about the pool it came from. */
  topicName?: string;
  alerts?: ("ran-out" | "recycled")[];
}

/** When a child is choosing: the moment, and the chart's time zone, which decides where days and weeks begin. */
export interface ChoosingContext {
  now: Date;
  timeZone: string;
}

/**
 * How the tasks in a category behave. Every kind (chore, quiz, and any added later) implements this one
 * interface, so the rest of the system never needs to know which kind it's dealing with.
 */
export interface TaskKind {
  name: TaskKindName;
  /** Everything of this kind the child can choose right now (tasks that are retired are never offered). */
  choicesFor(db: Database, context: ChoosingContext, childId: string): Promise<Choice[]>;
  /**
   * The ticket's title, stars and code for a choice; "done" if the child can't do it again for now; "empty" if there's
   * nothing to print for it yet (a quiz topic with no quizzes); or undefined if it isn't one this child can choose.
   */
  issue(db: Database, context: ChoosingContext, childId: string, taskId: string): Promise<IssuedTask | "done" | "empty" | undefined>;
}

export const choreKind: TaskKind = {
  name: "chore",

  async choicesFor(db, context, childId) {
    const chores = await db
      .selectFrom("chores")
      .innerJoin("chore_assignments", "chore_assignments.chore_id", "chores.id")
      .select([
        "chores.id",
        "chores.name",
        "chores.stars",
        "chores.icon",
        "chores.category_id",
        "chores.frequency_times",
        "chores.frequency_per",
      ])
      .where("chore_assignments.child_id", "=", childId)
      .where("chores.retired_at", "is", null)
      .orderBy("chores.name")
      .execute();
    const choices: Choice[] = [];
    for (const chore of chores) {
      // A chore counts against its frequency when it's approved, whenever it was printed.
      const since = startOfPeriod(context.now, context.timeZone, chore.frequency_per);
      const { approvals } = await db
        .selectFrom("ticket_events")
        .innerJoin("tickets", "tickets.id", "ticket_events.ticket_id")
        .select(sql<string>`count(*)`.as("approvals"))
        .where("tickets.chore_id", "=", chore.id)
        .where("tickets.child_id", "=", childId)
        .where("ticket_events.action", "=", "approved")
        .where("ticket_events.created_at", ">=", since)
        .executeTakeFirstOrThrow();
      choices.push({
        kind: "chore",
        id: chore.id,
        name: chore.name,
        stars: chore.stars,
        icon: chore.icon,
        categoryId: chore.category_id,
        done: Number(approvals) >= chore.frequency_times,
      });
    }
    return choices;
  },

  async issue(db, context, childId, taskId) {
    if (!isId(taskId)) return undefined;
    const chore = (await this.choicesFor(db, context, childId)).find((choice) => choice.id === taskId);
    if (!chore) return undefined;
    if (chore.done) return "done";
    // A chore's code belongs to the child and the chore, not to one printing (ADR 0001).
    await db
      .insertInto("chore_codes")
      .values({ child_id: childId, chore_id: chore.id, code: newTicketCode() })
      .onConflict((oc) => oc.columns(["child_id", "chore_id"]).doNothing())
      .execute();
    const { code } = await db
      .selectFrom("chore_codes")
      .select("code")
      .where("child_id", "=", childId)
      .where("chore_id", "=", chore.id)
      .executeTakeFirstOrThrow();
    return { title: chore.name, categoryId: chore.categoryId, icon: chore.icon, stars: chore.stars, code, choreId: chore.id };
  },
};

export const quizKind: TaskKind = {
  name: "quiz",

  // A child can choose any topic that's switched on for them.
  async choicesFor(db, _context, childId) {
    const topics = await db
      .selectFrom("topics")
      .innerJoin("topic_children", "topic_children.topic_id", "topics.id")
      .select(["topics.id", "topics.name", "topics.stars", "topics.icon", "topics.category_id as categoryId"])
      .where("topic_children.child_id", "=", childId)
      .where("topics.retired_at", "is", null)
      .orderBy("topics.name")
      .execute();
    return topics.map((topic) => ({ kind: "quiz" as const, ...topic, done: false }));
  },

  /**
   * What to print, in order: the oldest quiz waiting in the child's pool for this topic at their current level; if the
   * pool is empty, a fresh quiz from the topic's built-in sample set; failing that, the quiz the child did least
   * recently, reused (and grown-ups are told); and if there's nothing at all, "empty".
   */
  async issue(db, context, childId, taskId) {
    if (!isId(taskId)) return undefined;
    const topic = await db
      .selectFrom("topics")
      .innerJoin("topic_children", "topic_children.topic_id", "topics.id")
      .innerJoin("children", "children.id", "topic_children.child_id")
      .select([
        "topics.id",
        "topics.name",
        "topics.stars",
        "topics.icon",
        "topics.samples",
        "topics.category_id",
        "topic_children.level",
        "children.chart_id",
      ])
      .where("topics.id", "=", taskId)
      .where("topics.retired_at", "is", null)
      .where("topic_children.child_id", "=", childId)
      .executeTakeFirst();
    if (!topic) return undefined;

    const takeOldest = (state: "pooled" | "printed") =>
      db
        .selectFrom("quizzes")
        .select(["id", "title", "instructions", "items"])
        .where("child_id", "=", childId)
        .where("topic_id", "=", topic.id)
        .where("level", "=", topic.level)
        .where("state", "=", state)
        // Pooled quizzes go in the order they arrived; reused ones, least recently printed first.
        .orderBy(state === "pooled" ? "seq" : "printed_at")
        .limit(1)
        // SKIP LOCKED: two prints at once each take a different quiz, rather than the same one.
        .forUpdate()
        .skipLocked()
        .executeTakeFirst();

    const alerts: ("ran-out" | "recycled")[] = [];
    let quiz = await takeOldest("pooled");
    if (!quiz && topic.samples) {
      const added = await addQuiz(db, context.now, topic.chart_id, {
        childId,
        topicId: topic.id,
        ...sampleQuiz(topic.samples, topic.level),
      });
      if (!("refused" in added)) quiz = await takeOldest("pooled");
    }
    if (!quiz) {
      quiz = await takeOldest("printed");
      if (quiz) alerts.push("recycled");
    }
    if (!quiz) return "empty";
    await db.updateTable("quizzes").set({ state: "printed", printed_at: context.now }).where("id", "=", quiz.id).execute();

    if (!topic.samples && !alerts.includes("recycled")) {
      const { left } = await db
        .selectFrom("quizzes")
        .select(sql<string>`count(*)`.as("left"))
        .where("child_id", "=", childId)
        .where("topic_id", "=", topic.id)
        .where("level", "=", topic.level)
        .where("state", "=", "pooled")
        .executeTakeFirstOrThrow();
      if (Number(left) === 0) alerts.push("ran-out");
    }
    return {
      title: quiz.title,
      categoryId: topic.category_id,
      icon: topic.icon,
      stars: topic.stars,
      code: newTicketCode(),
      choreId: null,
      quizId: quiz.id,
      topicId: topic.id,
      topicName: topic.name,
      quiz: { instructions: quiz.instructions, prompts: quiz.items.map((item) => item.prompt) },
      alerts,
    };
  },
};

const kinds: Record<TaskKindName, TaskKind> = { chore: choreKind, quiz: quizKind };

export function taskKind(name: TaskKindName): TaskKind {
  return kinds[name];
}

export const allTaskKinds: TaskKind[] = Object.values(kinds);
