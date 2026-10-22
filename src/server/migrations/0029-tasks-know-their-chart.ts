import { sql, type Kysely } from "kysely";

// Tasks may have no category now, so each records its own chart rather than finding it through a category.
export async function up(db: Kysely<any>): Promise<void> {
  for (const table of ["chores", "topics"]) {
    await db.schema
      .alterTable(table)
      .addColumn("chart_id", "uuid", (col) => col.references("charts.id").onDelete("cascade"))
      .execute();
    await sql`
      UPDATE ${sql.table(table)} AS task SET chart_id = category.chart_id
      FROM task_categories AS category WHERE category.id = task.category_id
    `.execute(db);
    await sql`ALTER TABLE ${sql.table(table)} ALTER COLUMN chart_id SET NOT NULL`.execute(db);
    await db.schema.createIndex(`${table}_chart_id`).on(table).column("chart_id").execute();
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  for (const table of ["chores", "topics"]) await db.schema.alterTable(table).dropColumn("chart_id").execute();
}
