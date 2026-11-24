import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Pictures uploaded by a chart's grown-ups, such as their own stickers. Small files, kept in the database for now
  // (see src/server/art-files/art-files.ts, the one place that would change for a bucket).
  await db.schema
    .createTable("art_files")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("chart_id", "uuid", (col) => col.notNull().references("charts.id").onDelete("cascade"))
    .addColumn("content_type", "text", (col) => col.notNull())
    .addColumn("bytes", "bytea", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();

  // A store item is either built in (its name, kind and picture come with the app) or the chart's own sticker, with its
  // name and uploaded picture here.
  await db.schema
    .alterTable("store_items")
    .addColumn("name", "text")
    .addColumn("kind", "text")
    .addColumn("art_file_id", "uuid", (col) => col.references("art_files.id"))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("store_items").dropColumn("art_file_id").dropColumn("kind").dropColumn("name").execute();
  await db.schema.dropTable("art_files").execute();
}
