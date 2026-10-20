import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // A grown-up's PIN for unlocking the Control Center on an observatory, hashed like a password.
  await db.schema.alterTable("grown_ups").addColumn("pin_hash", "text").execute();
  // Sessions started on an observatory with a PIN end on their own; ordinary sign-ins have no expiry.
  await db.schema.alterTable("sessions").addColumn("expires_at", "timestamptz").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("sessions").dropColumn("expires_at").execute();
  await db.schema.alterTable("grown_ups").dropColumn("pin_hash").execute();
}
