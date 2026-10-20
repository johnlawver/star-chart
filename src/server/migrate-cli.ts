import { createDatabase, migrateToLatest } from "./database.js";

// Applies any migrations that haven't run yet. The server also does this when it starts.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set. Run with `doppler run -- …`.");
const db = createDatabase(databaseUrl);
try {
  await migrateToLatest(db);
  console.log("Database is up to date.");
} finally {
  await db.destroy();
}
