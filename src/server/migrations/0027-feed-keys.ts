import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // A credential an admin makes so a quiz feed can reach this chart's quiz pools (ADR 0004). Only a hash is kept.
  await db.schema
    .createTable("feed_keys")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("chart_id", "uuid", (col) => col.notNull().references("charts.id").onDelete("cascade"))
    .addColumn("key_hash", "text", (col) => col.notNull().unique())
    .addColumn("label", "text")
    .addColumn("created_by_grown_up_id", "uuid", (col) => col.references("grown_ups.id").onDelete("set null"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addColumn("last_used_at", "timestamptz")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("feed_keys").execute();
}
