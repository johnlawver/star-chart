import { loadConfig } from "./config.js";
import { createDatabase, migrateToLatest } from "./database.js";

// Applies any migrations that haven't run yet. The server also does this when it starts.
const db = createDatabase(loadConfig().databaseUrl);
try {
  await migrateToLatest(db);
  console.log("Database is up to date.");
} finally {
  await db.destroy();
}
