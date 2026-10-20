import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // A single-use, hour-long link for choosing a new password. Only a hash of the link's token is kept.
  await db.schema
    .createTable("password_resets")
    .addColumn("token_hash", "text", (col) => col.primaryKey())
    .addColumn("grown_up_id", "uuid", (col) => col.notNull().references("grown_ups.id").onDelete("cascade"))
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("password_resets").execute();
}
