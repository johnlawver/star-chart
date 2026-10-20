import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Who did what to each ticket, and when. A removed grown-up's entries stay, with no grown-up attached.
  await db.schema
    .createTable("ticket_events")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("ticket_id", "uuid", (col) => col.notNull().references("tickets.id").onDelete("cascade"))
    .addColumn("action", "text", (col) => col.notNull().check(sql`action in ('approved', 'rejected', 'dismissed')`))
    .addColumn("grown_up_id", "uuid", (col) => col.references("grown_ups.id").onDelete("set null"))
    .addColumn("note", "text")
    .addColumn("stars", "integer")
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();
  await db.schema.createIndex("ticket_events_ticket_id").on("ticket_events").column("ticket_id").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("ticket_events").execute();
}
