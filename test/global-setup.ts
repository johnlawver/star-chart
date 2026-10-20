import { resetAndMigrate } from "./support/database.js";

// Runs once before the whole test run: start every run from an empty, fully migrated test database.
export default async function setup() {
  await resetAndMigrate();
}
