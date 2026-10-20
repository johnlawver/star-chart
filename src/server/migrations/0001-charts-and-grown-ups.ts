import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("charts")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("time_zone", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("grown_ups")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("chart_id", "uuid", (col) => col.notNull().references("charts.id").onDelete("cascade"))
    .addColumn("email", "text", (col) => col.notNull())
    .addColumn("password_hash", "text", (col) => col.notNull())
    .addColumn("role", "text", (col) => col.notNull().check(sql`role in ('owner', 'admin', 'grown-up')`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();
  // A person belongs to exactly one chart, so an email address can only be used once, ignoring case.
  await sql`CREATE UNIQUE INDEX grown_ups_email_unique ON grown_ups (lower(email))`.execute(db);

  await db.schema
    .createTable("sessions")
    .addColumn("token_hash", "text", (col) => col.primaryKey())
    .addColumn("grown_up_id", "uuid", (col) => col.notNull().references("grown_ups.id").onDelete("cascade"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("sessions").execute();
  await db.schema.dropTable("grown_ups").execute();
  await db.schema.dropTable("charts").execute();
}
