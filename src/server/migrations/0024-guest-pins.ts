import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // A short-lived, anonymous PIN a grown-up makes so a guest (a babysitter) can handle tickets at an observatory.
  await db.schema
    .createTable("guest_pins")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("chart_id", "uuid", (col) => col.notNull().references("charts.id").onDelete("cascade"))
    .addColumn("pin_hash", "text", (col) => col.notNull())
    .addColumn("label", "text")
    .addColumn("created_by_grown_up_id", "uuid", (col) => col.references("grown_ups.id").onDelete("set null"))
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("cancelled_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();

  // A guest's session on an observatory. Ends with the PIN, or sooner.
  await db.schema
    .createTable("guest_sessions")
    .addColumn("token_hash", "text", (col) => col.primaryKey())
    .addColumn("guest_pin_id", "uuid", (col) => col.notNull().references("guest_pins.id").onDelete("cascade"))
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .execute();

  // Decisions made by a guest are recorded as such.
  await db.schema.alterTable("ticket_events").addColumn("by_guest", "boolean", (col) => col.notNull().defaultTo(false)).execute();
  await db.schema
    .alterTable("reprint_requests")
    .addColumn("decided_by_guest", "boolean", (col) => col.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("reprint_requests").dropColumn("decided_by_guest").execute();
  await db.schema.alterTable("ticket_events").dropColumn("by_guest").execute();
  await db.schema.dropTable("guest_sessions").execute();
  await db.schema.dropTable("guest_pins").execute();
}
