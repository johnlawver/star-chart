import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // A device (phone, computer) where a grown-up turned on push notifications.
  await db.schema
    .createTable("push_subscriptions")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("grown_up_id", "uuid", (col) => col.notNull().references("grown_ups.id").onDelete("cascade"))
    .addColumn("endpoint", "text", (col) => col.notNull().unique())
    .addColumn("p256dh", "text", (col) => col.notNull())
    .addColumn("auth", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();

  // Hand-in notifications are grouped per chart: when the last one went out, and how many are held back since.
  await db.schema
    .createTable("hand_in_notices")
    .addColumn("chart_id", "uuid", (col) => col.primaryKey().references("charts.id").onDelete("cascade"))
    .addColumn("last_sent_at", "timestamptz", (col) => col.notNull())
    .addColumn("held_back", "integer", (col) => col.notNull().defaultTo(0))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("hand_in_notices").execute();
  await db.schema.dropTable("push_subscriptions").execute();
}
