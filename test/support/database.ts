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
