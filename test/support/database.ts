import { createDatabase, migrateToLatest, type Database } from "../../src/server/database.js";
import { sql } from "kysely";

// The test database is local and throwaway, so its URL isn't a secret. TEST_DATABASE_URL overrides it.
export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://star_chart:star_chart_local@localhost:54329/star_chart_test";

export function createTestDatabase(): Database {
  return createDatabase(testDatabaseUrl);
}

export async function resetAndMigrate(): Promise<void> {
  const db = createTestDatabase();
  try {
    await sql`DROP SCHEMA IF EXISTS public CASCADE`.execute(db);
    await sql`CREATE SCHEMA public`.execute(db);
    await migrateToLatest(db);
  } finally {
    await db.destroy();
  }
}

/**
 * How many rows, in any table, still point at something through a column of this name (for example every
 * `child_id` equal to a deleted child's id). Tables are discovered from the database itself, so tables added later
 * are checked too. Used only to prove deletion really deletes: an API can show data is hidden, but not that it's gone.
 */
export async function rowsStillPointingAt(column: string, ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const db = createTestDatabase();
  try {
    const tables = await sql<{ table_name: string }>`
      SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = ${column}
    `.execute(db);
    const found: Record<string, number> = {};
    for (const { table_name } of tables.rows) {
      const { rows } = await sql<{ count: string }>`
        SELECT count(*) FROM ${sql.table(table_name)} WHERE ${sql.ref(column)} = ANY(${ids}::uuid[])
      `.execute(db);
      const count = Number(rows[0]?.count ?? 0);
      if (count > 0) found[table_name] = count;
    }
    return found;
  } finally {
    await db.destroy();
  }
}
