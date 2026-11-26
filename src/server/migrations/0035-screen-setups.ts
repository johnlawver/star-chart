import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // A fresh observatory screen being set up from a phone. The screen shows the code (as a QR) and keeps the secret.
  // A grown-up approves the code for their chart; the screen then collects its credential with the secret.
  await db.schema
    .createTable("screen_setups")
    .addColumn("code_hash", "text", (col) => col.primaryKey())
    .addColumn("secret_hash", "text", (col) => col.notNull().unique())
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("chart_id", "uuid", (col) => col.references("charts.id").onDelete("cascade"))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("screen_setups").execute();
}
