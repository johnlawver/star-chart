import { sql } from "kysely";
import type { Database, TaskKindName } from "../database.js";
import { isId } from "../ids.js";
import { startOfPeriod } from "../time.js";
import { newTicketCode } from "../tokens.js";

/** Something a child can pick at the observatory within a category, such as one chore. */
export interface Choice {
  id: string;
  name: string;
  stars: number;
  icon: string | null;
  /** Already done as often as it can earn stars for now (for example, once today), so it can't be printed. */
  done: boolean;
}

/** What goes on a ticket when a child chooses something. */
export interface IssuedTask {
  title: string;
  icon: string | null;
  stars: number;
  code: string;
  choreId: string | null;
  /** For a quiz: which quiz and topic, and what's printed (instructions and prompts, never the answers). */
  quizId?: string;
  topicId?: string;
  quiz?: { instructions: string; prompts: string[] };
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
  /** What this child can choose from this category right now. */
  choicesFor(db: Database, context: ChoosingContext, categoryId: string, childId: string): Promise<Choice[]>;
  /**
   * The ticket's title, stars and code for a choice; "done" if the child can't do it again for now; "empty" if there's
   * nothing to print for it yet (a quiz topic with no quizzes); or undefined if it isn't one this child can choose.
   */
  issue(
    db: Database,
    context: ChoosingContext,
    categoryId: string,
    childId: string,
    choiceId: string,
  ): Promise<IssuedTask | "done" | "empty" | undefined>;
}

export const choreKind: TaskKind = {
  name: "chore",

  async choicesFor(db, context, categoryId, childId) {
    const chores = await db
      .selectFrom("chores")
      .innerJoin("chore_assignments", "chore_assignments.chore_id", "chores.id")
      .select([
        "chores.id",
        "chores.name",
        "chores.stars",
        "chores.icon",
        "chores.frequency_times",
        "chores.frequency_per",
      ])
      .where("chores.category_id", "=", categoryId)
      .where("chore_assignments.child_id", "=", childId)
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
        id: chore.id,
        name: chore.name,
        stars: chore.stars,
        icon: chore.icon,
        done: Number(approvals) >= chore.frequency_times,
      });
    }
    return choices;
  },

  async issue(db, context, categoryId, childId, choiceId) {
    if (!isId(choiceId)) return undefined;
    const chore = (await this.choicesFor(db, context, categoryId, childId)).find((choice) => choice.id === choiceId);
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
    return { title: chore.name, icon: chore.icon, stars: chore.stars, code, choreId: chore.id };
  },
};

export const quizKind: TaskKind = {
  name: "quiz",

  // A child can choose any topic in the category that's switched on for them.
  async choicesFor(db, _context, categoryId, childId) {
    const topics = await db
      .selectFrom("topics")
      .innerJoin("topic_children", "topic_children.topic_id", "topics.id")
      .select(["topics.id", "topics.name", "topics.stars", "topics.icon"])
      .where("topics.category_id", "=", categoryId)
      .where("topic_children.child_id", "=", childId)
      .orderBy("topics.name")
      .execute();
    return topics.map((topic) => ({ ...topic, done: false }));
  },

  // The oldest quiz waiting in the child's pool for this topic, at their current level.
  async issue(db, context, categoryId, childId, choiceId) {
    if (!isId(choiceId)) return undefined;
    const topic = await db
      .selectFrom("topics")
      .innerJoin("topic_children", "topic_children.topic_id", "topics.id")
      .select(["topics.id", "topics.stars", "topics.icon", "topic_children.level"])
      .where("topics.category_id", "=", categoryId)
      .where("topics.id", "=", choiceId)
      .where("topic_children.child_id", "=", childId)
      .executeTakeFirst();
    if (!topic) return undefined;
    // SKIP LOCKED: two prints at once each take a different quiz, rather than the same one.
    const quiz = await db
      .selectFrom("quizzes")
      .select(["id", "title", "instructions", "items"])
      .where("child_id", "=", childId)
      .where("topic_id", "=", topic.id)
      .where("level", "=", topic.level)
      .where("state", "=", "pooled")
      .orderBy("seq")
      .limit(1)
      .forUpdate()
      .skipLocked()
      .executeTakeFirst();
    if (!quiz) return "empty";
    await db.updateTable("quizzes").set({ state: "printed", printed_at: context.now }).where("id", "=", quiz.id).execute();
    return {
      title: quiz.title,
      icon: topic.icon,
      stars: topic.stars,
      code: newTicketCode(),
      choreId: null,
      quizId: quiz.id,
      topicId: topic.id,
      quiz: { instructions: quiz.instructions, prompts: quiz.items.map((item) => item.prompt) },
    };
  },
};

const kinds: Record<TaskKindName, TaskKind> = { chore: choreKind, quiz: quizKind };

export function taskKind(name: TaskKindName): TaskKind {
  return kinds[name];
}
