import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Every star a child earns or spends, never edited or deleted (except along with the child).
  // A balance is always the sum of these, never stored.
  await db.schema
    .createTable("star_movements")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("chart_id", "uuid", (col) => col.notNull().references("charts.id").onDelete("cascade"))
    .addColumn("child_id", "uuid", (col) => col.notNull().references("children.id").onDelete("cascade"))
    .addColumn("amount", "integer", (col) => col.notNull())
    .addColumn("ticket_id", "uuid", (col) => col.references("tickets.id").onDelete("set null"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();
  await db.schema.createIndex("star_movements_child_id").on("star_movements").column("child_id").execute();

  // The stars actually awarded when a ticket was approved, which may differ from the task's value.
  await db.schema.alterTable("tickets").addColumn("awarded_stars", "integer").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("tickets").dropColumn("awarded_stars").execute();
  await db.schema.dropTable("star_movements").execute();
}
