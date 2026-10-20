import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // The code printed on a child's ticket for a chore. It never changes for that child and chore (ADR 0001).
  await db.schema
    .createTable("chore_codes")
    .addColumn("child_id", "uuid", (col) => col.notNull().references("children.id").onDelete("cascade"))
    .addColumn("chore_id", "uuid", (col) => col.notNull().references("chores.id").onDelete("cascade"))
    .addColumn("code", "text", (col) => col.notNull().unique())
    .addPrimaryKeyConstraint("chore_codes_pk", ["child_id", "chore_id"])
    .execute();

  await db.schema
    .createTable("tickets")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("chart_id", "uuid", (col) => col.notNull().references("charts.id").onDelete("cascade"))
    .addColumn("child_id", "uuid", (col) => col.notNull().references("children.id").onDelete("cascade"))
    .addColumn("category_id", "uuid", (col) => col.notNull().references("task_categories.id").onDelete("cascade"))
    .addColumn("chore_id", "uuid", (col) => col.references("chores.id").onDelete("cascade"))
    .addColumn("code", "text", (col) => col.notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("stars", "integer", (col) => col.notNull())
    .addColumn("state", "text", (col) =>
      col.notNull().check(sql`state in ('open', 'handed-in', 'approved', 'dismissed')`),
    )
    .addColumn("printed_by_observatory_id", "uuid", (col) => col.references("observatories.id").onDelete("set null"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();
  await db.schema.createIndex("tickets_code").on("tickets").column("code").execute();
  await db.schema.createIndex("tickets_child_id").on("tickets").column("child_id").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("tickets").execute();
  await db.schema.dropTable("chore_codes").execute();
}
