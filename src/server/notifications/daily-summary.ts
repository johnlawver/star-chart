import { sql } from "kysely";
import type { Clock } from "../clock.js";
import type { Database } from "../database.js";
import { startOfPeriod } from "../time.js";
import type { Notifications } from "./notifications.js";

/** The local hour (in each chart's own time zone) when its daily summary goes out. */
const summaryHour = 19;

/**
 * Each evening at 7pm in a chart's time zone, its grown-ups get each child's stars earned that day and their
 * open tickets. If the server was down at 7pm, it goes out when the server is back that evening; after the chart's
 * midnight, that day's is skipped rather than sent late.
 */
export function createDailySummary(db: Database, clock: Clock, notifications: Notifications, appUrl: string) {
  return {
    /** Scheduled job: sends every summary that's due now. */
    async sendDue(): Promise<void> {
      const now = clock.now();
      const charts = await db.selectFrom("charts").select(["id", "name", "time_zone", "daily_summary_sent_on"]).execute();
      for (const chart of charts) {
        const local = Temporal.Instant.fromEpochMilliseconds(now.getTime()).toZonedDateTimeISO(chart.time_zone);
        const today = local.toPlainDate().toString();
        if (local.hour < summaryHour || chart.daily_summary_sent_on === today) continue;
        // Claims today's summary first, so it goes out once even if two runs overlap.
        const claimed = await db
          .updateTable("charts")
          .set({ daily_summary_sent_on: today })
          .where("id", "=", chart.id)
          .where((eb) => eb.or([eb("daily_summary_sent_on", "is", null), eb("daily_summary_sent_on", "!=", today)]))
          .executeTakeFirst();
        if (claimed.numUpdatedRows === 0n) continue;
        const since = startOfPeriod(now, chart.time_zone, "day");
        const children = await db
          .selectFrom("children")
          .select([
            "children.nickname",
            (eb) =>
              eb
                .selectFrom("star_movements")
                .select(sql<string>`coalesce(sum(amount), 0)`.as("earned"))
                .whereRef("star_movements.child_id", "=", "children.id")
                .where("star_movements.amount", ">", 0)
                .where("star_movements.created_at", ">=", since)
                .as("earnedToday"),
            (eb) =>
              eb
                .selectFrom("tickets")
                .select(sql<string>`count(*)`.as("open"))
                .whereRef("tickets.child_id", "=", "children.id")
                .where("tickets.state", "=", "open")
                .as("openTickets"),
          ])
          .where("children.chart_id", "=", chart.id)
          .orderBy("children.nickname")
          .execute();
        if (children.length === 0) continue;
        const lines = children.map((child) => {
          const open = Number(child.openTickets);
          const tickets = open === 0 ? "nothing open" : open === 1 ? "1 open ticket" : `${open} open tickets`;
          return `${child.nickname}: ${Number(child.earnedToday)} ★, ${tickets}.`;
        });
        await notifications.toChart(chart.id, {
          title: `Today at ${chart.name}`,
          body: lines.join(" "),
          url: `${appUrl}/`,
          tag: "daily-summary",
        });
      }
    },
  };
}
