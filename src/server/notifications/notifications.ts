import { sql } from "kysely";
import type { Clock } from "../clock.js";
import type { Database } from "../database.js";
import type { PushMessage, PushSender, PushSubscription } from "../push.js";

/** The notifications module: which devices want push notifications, and what gets sent to them. */
export function createNotifications(
  db: Database,
  clock: Clock,
  push: PushSender,
  settings: { appUrl: string; handInGroupingMs: number },
  /** Where to report a device that couldn't be reached, without stopping anything else. */
  logFailure: (details: { endpoint: string; error: unknown }) => void,
) {
  /**
   * Sends a notification to each of some devices separately: one failing (the push service refusing it, say) is
   * logged and never stops the others, or the server. Devices the push service says are gone are forgotten.
   */
  async function sendTo(
    subscriptions: { endpoint: string; p256dh: string; auth: string }[],
    message: PushMessage,
  ): Promise<{ devices: number; delivered: number }> {
    const results = await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          const result = await push.send(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            message,
          );
          if (result === "gone") {
            await db.deleteFrom("push_subscriptions").where("endpoint", "=", subscription.endpoint).execute();
          }
          return result === "sent";
        } catch (error) {
          logFailure({ endpoint: subscription.endpoint, error });
          return false;
        }
      }),
    );
    return { devices: subscriptions.length, delivered: results.filter(Boolean).length };
  }

  const subscriptionsWhere = () =>
    db
      .selectFrom("push_subscriptions")
      .innerJoin("grown_ups", "grown_ups.id", "push_subscriptions.grown_up_id")
      .select(["push_subscriptions.endpoint", "push_subscriptions.p256dh", "push_subscriptions.auth"]);

  /** Sends a notification to every subscribed device of every grown-up in a chart. */
  async function toChart(chartId: string, message: PushMessage): Promise<void> {
    await sendTo(await subscriptionsWhere().where("grown_ups.chart_id", "=", chartId).execute(), message);
  }

  const controlCenter = () => `${settings.appUrl}/`;

  return {
    toChart,

    /** A grown-up turns on notifications on a device. A device belongs to whoever subscribed it most recently. */
    async subscribe(grownUpId: string, subscription: PushSubscription): Promise<void> {
      await db
        .insertInto("push_subscriptions")
        .values({
          grown_up_id: grownUpId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          created_at: clock.now(),
        })
        .onConflict((oc) =>
          oc.column("endpoint").doUpdateSet({
            grown_up_id: grownUpId,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          }),
        )
        .execute();
    },

    async unsubscribe(grownUpId: string, endpoint: string): Promise<void> {
      await db
        .deleteFrom("push_subscriptions")
        .where("grown_up_id", "=", grownUpId)
        .where("endpoint", "=", endpoint)
        .execute();
    },

    /**
     * A child handed in a ticket. The first hand-in in a while is sent straight away; any more within the grouping
     * window are held back and sent together by the scheduled job, so a busy morning doesn't send ten notifications.
     */
    async handedIn(chartId: string, handIn: { childNickname: string; title: string }): Promise<void> {
      const now = clock.now();
      const windowStart = new Date(now.getTime() - settings.handInGroupingMs);
      const recent = await db
        .updateTable("hand_in_notices")
        .set((eb) => ({ held_back: eb("held_back", "+", 1) }))
        .where("chart_id", "=", chartId)
        .where("last_sent_at", ">", windowStart)
        .returning("chart_id")
        .executeTakeFirst();
      if (recent) return;
      await db
        .insertInto("hand_in_notices")
        .values({ chart_id: chartId, last_sent_at: now, held_back: 0 })
        .onConflict((oc) => oc.column("chart_id").doUpdateSet({ last_sent_at: now, held_back: 0 }))
        .execute();
      await toChart(chartId, {
        title: `${handIn.childNickname} handed in a ticket`,
        body: `"${handIn.title}" is waiting for you to check.`,
        url: controlCenter(),
        tag: "hand-ins",
      });
    },

    /** Scheduled job: once a grouping window has passed, sends the hand-ins held back during it as one notification. */
    async sendHeldBackHandIns(): Promise<void> {
      const now = clock.now();
      const windowStart = new Date(now.getTime() - settings.handInGroupingMs);
      // Reads each count and clears it in one statement, so a hand-in is never sent twice, or lost in between.
      const due = await sql<{ chart_id: string; held_back: number }>`
        UPDATE hand_in_notices AS notice
        SET held_back = 0, last_sent_at = ${now}
        FROM (
          SELECT chart_id, held_back FROM hand_in_notices
          WHERE held_back > 0 AND last_sent_at <= ${windowStart}
          FOR UPDATE
        ) AS before
        WHERE notice.chart_id = before.chart_id
        RETURNING before.chart_id, before.held_back
      `.execute(db);
      for (const { chart_id, held_back } of due.rows) {
        await toChart(chart_id, {
          title: held_back === 1 ? "1 more ticket handed in" : `${held_back} more tickets handed in`,
          body: "They're waiting for you to check.",
          url: controlCenter(),
          tag: "hand-ins",
        });
      }
    },

    /** A test notification to one grown-up's own devices, so they can check notifications reach them. */
    async test(grownUpId: string): Promise<{ devices: number; delivered: number }> {
      return sendTo(await subscriptionsWhere().where("grown_ups.id", "=", grownUpId).execute(), {
        title: "Star Chart notifications work!",
        body: "You'll get one like this when a ticket needs you.",
        url: controlCenter(),
        tag: "test",
      });
    },

    /** The devices where a grown-up has turned on notifications. */
    async subscriptionsOf(grownUpId: string): Promise<{ endpoint: string }[]> {
      return db.selectFrom("push_subscriptions").select("endpoint").where("grown_up_id", "=", grownUpId).execute();
    },

    /** A child's quiz pool for a topic ran out, or an old quiz had to be reused because it had. */
    async quizPoolAlerts(
      chartId: string,
      about: { childNickname: string; topicName: string; alerts: ("ran-out" | "recycled")[] },
    ): Promise<void> {
      for (const alert of about.alerts) {
        await toChart(chartId, {
          title:
            alert === "ran-out"
              ? `${about.childNickname}'s ${about.topicName} quizzes ran out`
              : `Reusing an old ${about.topicName} quiz for ${about.childNickname}`,
          body:
            alert === "ran-out"
              ? "That was the last one waiting. New ones are needed."
              : "There were no new ones waiting, so an old one was printed again.",
          url: controlCenter(),
          tag: `quiz-pool-${about.topicName}`,
        });
      }
    },

    /** A child asked for a lost ticket to be printed again. */
    async reprintRequested(chartId: string, request: { childNickname: string; title: string }): Promise<void> {
      await toChart(chartId, {
        title: `${request.childNickname} lost a ticket`,
        body: `Print "${request.title}" again?`,
        url: controlCenter(),
        tag: "reprint-requests",
      });
    },
  };
}

export type Notifications = ReturnType<typeof createNotifications>;
