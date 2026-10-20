import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Two decisions can share a timestamp, so history is ordered by this ever-increasing number instead.
  await sql`ALTER TABLE ticket_events ADD COLUMN seq bigint GENERATED ALWAYS AS IDENTITY`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("ticket_events").dropColumn("seq").execute();
}
