import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // A child asking, from an observatory, for a lost ticket to be printed again. It prints only once a grown-up says yes.
  await db.schema
    .createTable("reprint_requests")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("chart_id", "uuid", (col) => col.notNull().references("charts.id").onDelete("cascade"))
    .addColumn("ticket_id", "uuid", (col) => col.notNull().references("tickets.id").onDelete("cascade"))
    // Where the child asked, so the copy prints where they are.
    .addColumn("observatory_id", "uuid", (col) => col.references("observatories.id").onDelete("set null"))
    .addColumn("state", "text", (col) => col.notNull().check(sql`state in ('pending', 'approved', 'declined')`))
    .addColumn("decided_by_grown_up_id", "uuid", (col) => col.references("grown_ups.id").onDelete("set null"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addColumn("decided_at", "timestamptz")
    .execute();
  // A ticket has at most one request waiting at a time.
  await sql`CREATE UNIQUE INDEX reprint_requests_one_pending ON reprint_requests (ticket_id) WHERE state = 'pending'`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("reprint_requests").execute();
}
