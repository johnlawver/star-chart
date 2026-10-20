import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Each observatory counts wrong PINs, and stops accepting any for a while after too many.
  await db.schema
    .alterTable("observatories")
    .addColumn("failed_pin_attempts", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("pin_locked_until", "timestamptz")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("observatories").dropColumn("failed_pin_attempts").dropColumn("pin_locked_until").execute();
}
