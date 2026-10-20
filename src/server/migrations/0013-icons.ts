import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // An icon from the built-in library (its id), for children whose display style is pictures.
  await db.schema.alterTable("task_categories").addColumn("icon", "text").execute();
  await db.schema.alterTable("chores").addColumn("icon", "text").execute();
  // Kept on the ticket so a reprint shows exactly what was printed.
  await db.schema.alterTable("tickets").addColumn("icon", "text").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("tickets").dropColumn("icon").execute();
  await db.schema.alterTable("chores").dropColumn("icon").execute();
  await db.schema.alterTable("task_categories").dropColumn("icon").execute();
}
