import type { FastifyReply, FastifyRequest } from "fastify";
import { sql } from "kysely";
import type { Clock } from "../clock.js";
import type { Database } from "../database.js";
import { isId } from "../ids.js";
import { hashToken, newToken } from "../tokens.js";

/** The quiz feed module (ADR 0004): Feed Keys, and what a quiz feed can see and do with a chart's quiz pools. */
export function createQuizFeed(db: Database, clock: Clock) {
  return {
    /** Makes a Feed Key for the chart. The key itself is returned this once; only its hash is kept. */
    async makeKey(chartId: string, createdBy: string, label?: string): Promise<{ id: string; key: string }> {
      const key = `feed_${newToken()}`;
      const made = await db
        .insertInto("feed_keys")
        .values({
          chart_id: chartId,
          key_hash: hashToken(key),
          label: label?.trim() || null,
          created_by_grown_up_id: createdBy,
          created_at: clock.now(),
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      return { id: made.id, key };
    },

    async listKeys(chartId: string) {
      const keys = await db
        .selectFrom("feed_keys")
        .select(["id", "label", "created_at", "last_used_at"])
        .where("chart_id", "=", chartId)
        .orderBy("created_at")
        .execute();
      return keys.map((key) => ({
        id: key.id,
        label: key.label,
        createdAt: key.created_at.toISOString(),
        lastUsedAt: key.last_used_at?.toISOString() ?? null,
      }));
    },

    /** Revokes a Feed Key: it stops working at once. */
    async revokeKey(chartId: string, keyId: string): Promise<boolean> {
      if (!isId(keyId)) return false;
      const result = await db.deleteFrom("feed_keys").where("chart_id", "=", chartId).where("id", "=", keyId).executeTakeFirst();
      return result.numDeletedRows > 0n;
    },

    /**
     * Every pool the feed could fill: each child (by id only, never by nickname) and each topic switched on for them,
     * at the child's current level, with how many quizzes are waiting and the chart's target size.
     */
    async pools(chartId: string) {
      const chart = await db.selectFrom("charts").select("quiz_pool_target").where("id", "=", chartId).executeTakeFirstOrThrow();
      const pools = await db
        .selectFrom("topic_children")
        .innerJoin("topics", "topics.id", "topic_children.topic_id")
        .innerJoin("task_categories", "task_categories.id", "topics.category_id")
        .innerJoin("children", "children.id", "topic_children.child_id")
        .select((eb) => [
          "topic_children.child_id as childId",
          "topics.id as topicId",
          "topics.name as topicName",
          "task_categories.name as categoryName",
          "topic_children.level",
          eb
            .selectFrom("quizzes")
            .select(sql<string>`count(*)`.as("waiting"))
            .whereRef("quizzes.child_id", "=", "topic_children.child_id")
            .whereRef("quizzes.topic_id", "=", "topic_children.topic_id")
            .whereRef("quizzes.level", "=", "topic_children.level")
            .where("quizzes.state", "=", "pooled")
            .as("waiting"),
        ])
        .where("task_categories.chart_id", "=", chartId)
        .where("children.chart_id", "=", chartId)
        .orderBy("topics.name")
        .orderBy("topic_children.child_id")
        .execute();
      return {
        targetSize: chart.quiz_pool_target,
        pools: pools.map((pool) => ({ ...pool, waiting: Number(pool.waiting) })),
      };
    },

    /** Withdraws a quiz the feed sent, by the feed's own id, as long as it hasn't been printed. */
    async withdraw(chartId: string, externalId: string): Promise<"withdrawn" | "printed" | "not-found"> {
      return db.transaction().execute(async (trx) => {
        const quiz = await trx
          .selectFrom("quizzes")
          .select(["id", "state"])
          .where("chart_id", "=", chartId)
          .where("external_id", "=", externalId)
          .forUpdate()
          .executeTakeFirst();
        if (!quiz) return "not-found";
        if (quiz.state === "printed") return "printed";
        await trx.updateTable("quizzes").set({ state: "withdrawn" }).where("id", "=", quiz.id).execute();
        return "withdrawn";
      });
    },

    /** The chart a Feed Key belongs to (noting that it was used), or undefined if it isn't a valid key. */
    async chartFor(key: string): Promise<string | undefined> {
      const found = await db
        .updateTable("feed_keys")
        .set({ last_used_at: clock.now() })
        .where("key_hash", "=", hashToken(key))
        .returning("chart_id")
        .executeTakeFirst();
      return found?.chart_id;
    },
  };
}

export type QuizFeed = ReturnType<typeof createQuizFeed>;

/**
 * The chart a quiz feed's request is for, from the Feed Key in its Authorization header, or undefined after
 * replying 401. Like every other credential, the key decides the chart: never the request.
 */
export async function requireFeed(
  feed: QuizFeed,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ chartId: string } | undefined> {
  const header = request.headers.authorization;
  const key = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  const chartId = key ? await feed.chartFor(key) : undefined;
  if (!chartId) {
    await reply.code(401).send({ error: "not a valid Feed Key" });
    return undefined;
  }
  return { chartId };
}
