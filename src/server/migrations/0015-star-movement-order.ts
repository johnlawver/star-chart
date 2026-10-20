import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Two movements can share a timestamp, so a constellation is ordered by this ever-increasing number.
  await sql`ALTER TABLE star_movements ADD COLUMN seq bigint GENERATED ALWAYS AS IDENTITY`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("star_movements").dropColumn("seq").execute();
}
