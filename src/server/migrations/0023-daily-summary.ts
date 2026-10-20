import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // The chart's local date (YYYY-MM-DD) whose daily summary has been sent, so each day's goes out exactly once.
  await db.schema.alterTable("charts").addColumn("daily_summary_sent_on", "text").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("charts").dropColumn("daily_summary_sent_on").execute();
}
