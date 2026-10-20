import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // A child may hold at most one open (or handed-in) ticket per category, even if two prints race each other.
  await sql`
    CREATE UNIQUE INDEX tickets_one_open_per_category
    ON tickets (child_id, category_id)
    WHERE state IN ('open', 'handed-in')
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX tickets_one_open_per_category`.execute(db);
}
