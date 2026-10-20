import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // A short code an observatory's screen shows so a printer or scanner can join it. Single-use and short-lived.
  await db.schema
    .createTable("pairing_codes")
    .addColumn("code_hash", "text", (col) => col.primaryKey())
    .addColumn("observatory_id", "uuid", (col) => col.notNull().references("observatories.id").onDelete("cascade"))
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("pairing_codes").execute();
}
