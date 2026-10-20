import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("task_categories")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("chart_id", "uuid", (col) => col.notNull().references("charts.id").onDelete("cascade"))
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("kind", "text", (col) => col.notNull().check(sql`kind in ('chore', 'quiz')`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("chores")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("category_id", "uuid", (col) => col.notNull().references("task_categories.id").onDelete("cascade"))
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("stars", "integer", (col) => col.notNull().check(sql`stars >= 0`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();

  // Which children each chore is assigned to.
  await db.schema
    .createTable("chore_assignments")
    .addColumn("chore_id", "uuid", (col) => col.notNull().references("chores.id").onDelete("cascade"))
    .addColumn("child_id", "uuid", (col) => col.notNull().references("children.id").onDelete("cascade"))
    .addPrimaryKeyConstraint("chore_assignments_pk", ["chore_id", "child_id"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("chore_assignments").execute();
  await db.schema.dropTable("chores").execute();
  await db.schema.dropTable("task_categories").execute();
}
