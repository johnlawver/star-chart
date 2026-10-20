import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("observatories")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("chart_id", "uuid", (col) => col.notNull().references("charts.id").onDelete("cascade"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();

  // Each part of an observatory (screen, printer, scanner) is a device with its own credential.
  await db.schema
    .createTable("devices")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("observatory_id", "uuid", (col) => col.notNull().references("observatories.id").onDelete("cascade"))
    .addColumn("kind", "text", (col) => col.notNull().check(sql`kind in ('screen', 'printer', 'scanner')`))
    .addColumn("token_hash", "text", (col) => col.notNull().unique())
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("devices").execute();
  await db.schema.dropTable("observatories").execute();
}
