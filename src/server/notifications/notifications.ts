import type { Clock } from "../clock.js";
import type { Database } from "../database.js";
import type { PushMessage, PushSender, PushSubscription } from "../push.js";

/** The notifications module: which devices want push notifications, and what gets sent to them. */
export function createNotifications(
  db: Database,
  clock: Clock,
  push: PushSender,
  settings: { appUrl: string; handInGroupingMs: number },
) {
  /** Sends a notification to every subscribed device of every grown-up in a chart, forgetting devices that are gone. */
  async function toChart(chartId: string, message: PushMessage): Promise<void> {
    const subscriptions = await db
      .selectFrom("push_subscriptions")
      .innerJoin("grown_ups", "grown_ups.id", "push_subscriptions.grown_up_id")
      .select(["push_subscriptions.endpoint", "push_subscriptions.p256dh", "push_subscriptions.auth"])
      .where("grown_ups.chart_id", "=", chartId)
      .execute();
    await Promise.all(
      subscriptions.map(async (subscription) => {
        const result = await push.send(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          message,
        );
        if (result === "gone") {
          await db.deleteFrom("push_subscriptions").where("endpoint", "=", subscription.endpoint).execute();
        }
      }),
    );
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
