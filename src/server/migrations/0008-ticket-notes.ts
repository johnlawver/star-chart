import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // A grown-up's note when rejecting a ticket, such as "the bowl is still empty!".
  await db.schema.alterTable("tickets").addColumn("note", "text").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("tickets").dropColumn("note").execute();
}
