import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // When a child last opened their screen at an observatory, so the stars approved since then can arrive as new stars.
  // Empty until their first visit, when the time they were added counts instead.
  await db.schema.alterTable("children").addColumn("last_visit_at", "timestamptz").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("children").dropColumn("last_visit_at").execute();
}
