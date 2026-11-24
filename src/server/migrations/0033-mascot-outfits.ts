import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // What each child's mascot is wearing: at most one hat and one hairstyle, each an item they own (or nothing).
  await db.schema.alterTable("children").addColumn("wearing_hat", "text").addColumn("wearing_hair", "text").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("children").dropColumn("wearing_hair").dropColumn("wearing_hat").execute();
}
