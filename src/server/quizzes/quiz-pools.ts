import type { Clock } from "../clock.js";
import type { Database, QuizItem } from "../database.js";
import { isId } from "../ids.js";

/** A quiz as it goes into a pool, from whoever wrote it: a grown-up, a built-in sample set, or the quiz feed. */
export interface NewQuiz {
  childId: string;
  topicId: string;
  /** Which of the child's levels it's for. Defaults to the child's current level for the topic. */
  level?: number;
  /** The quiz feed's own id for it, so the same quiz sent twice isn't added twice. */
  externalId?: string;
  title: string;
  instructions: string;
  items: QuizItem[];
}

/**
 * Puts a quiz in a child's pool. Refused if the child or topic isn't in this chart, or the topic isn't switched on for
 * the child. A quiz whose external id is already in the chart isn't added again. Everything that writes quizzes
 * (grown-ups, the built-in samples, the quiz feed) comes through here. Pass a transaction to make it part of one.
 */
export async function addQuiz(
  db: Database,
  now: Date,
  chartId: string,
  quiz: NewQuiz,
): Promise<{ id: string; duplicate: boolean } | { refused: string }> {
  if (!isId(quiz.childId) || !isId(quiz.topicId)) return { refused: "unknown child or topic" };
  const switchedOn = await db
    .selectFrom("topic_children")
    .innerJoin("topics", "topics.id", "topic_children.topic_id")
    .innerJoin("children", "children.id", "topic_children.child_id")
    .select("topic_children.level")
    .where("topics.chart_id", "=", chartId)
    .where("topics.retired_at", "is", null)
    .where("children.chart_id", "=", chartId)
    .where("topic_children.topic_id", "=", quiz.topicId)
    .where("topic_children.child_id", "=", quiz.childId)
    .executeTakeFirst();
  if (!switchedOn) return { refused: "that topic isn't switched on for that child" };
  const inserted = await db
    .insertInto("quizzes")
    .values({
      chart_id: chartId,
      child_id: quiz.childId,
      topic_id: quiz.topicId,
      level: quiz.level ?? switchedOn.level,
      external_id: quiz.externalId ?? null,
      title: quiz.title.trim(),
      instructions: quiz.instructions.trim(),
      items: JSON.stringify(quiz.items),
      state: "pooled",
      created_at: now,
    })
    .onConflict((oc) => oc.columns(["chart_id", "external_id"]).where("external_id", "is not", null).doNothing())
    .returning("id")
    .executeTakeFirst();
  if (inserted) return { id: inserted.id, duplicate: false };
  const existing = await db
    .selectFrom("quizzes")
    .select("id")
    .where("chart_id", "=", chartId)
    .where("external_id", "=", quiz.externalId!)
    .executeTakeFirstOrThrow();
  return { id: existing.id, duplicate: true };
}

/**
 * Quiz pools: the ready-made quizzes waiting to be printed, one pool per child, topic and level. Everything that writes
 * quizzes goes through `add`, so they're all checked and stored the same way.
 */
export function createQuizPools(db: Database, clock: Clock) {
  return {
    /**
     * Puts a quiz in a child's pool. Refused if the child or topic isn't in this chart, or the topic isn't switched
     * on for the child. A quiz whose external id is already in the chart isn't added again.
     */
    add: (chartId: string, quiz: NewQuiz) => addQuiz(db, clock.now(), chartId, quiz),
  };
}

export type QuizPools = ReturnType<typeof createQuizPools>;
