import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // A child is a nickname and a display style, nothing more: we keep as little as possible about children.
  await db.schema
    .createTable("children")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("chart_id", "uuid", (col) => col.notNull().references("charts.id").onDelete("cascade"))
    .addColumn("nickname", "text", (col) => col.notNull())
    .addColumn("display_style", "text", (col) => col.notNull().check(sql`display_style in ('pictures', 'words')`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();
  await db.schema.createIndex("children_chart_id").on("children").column("chart_id").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("children").execute();
}
