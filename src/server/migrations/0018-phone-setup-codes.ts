import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // A single-use, short-lived code (shown as a QR on an unlocked observatory) that signs a phone in as one grown-up.
  await db.schema
    .createTable("phone_setup_codes")
    .addColumn("code_hash", "text", (col) => col.primaryKey())
    .addColumn("grown_up_id", "uuid", (col) => col.notNull().references("grown_ups.id").onDelete("cascade"))
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("phone_setup_codes").execute();
}
