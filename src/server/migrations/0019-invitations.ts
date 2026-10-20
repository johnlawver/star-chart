import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // An emailed invitation to join a chart as a grown-up. Only a hash of the link's token is kept.
  await db.schema
    .createTable("invitations")
    .addColumn("token_hash", "text", (col) => col.primaryKey())
    .addColumn("chart_id", "uuid", (col) => col.notNull().references("charts.id").onDelete("cascade"))
    .addColumn("email", "text", (col) => col.notNull())
    .addColumn("invited_by_grown_up_id", "uuid", (col) => col.references("grown_ups.id").onDelete("set null"))
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("invitations").execute();
}
