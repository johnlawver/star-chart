import type { FastifyReply, FastifyRequest } from "fastify";
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
