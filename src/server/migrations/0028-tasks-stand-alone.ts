import { sql, type Kysely } from "kysely";

// Tasks stand alone; a category is an optional folder (which may mix chores and quizzes).
export async function up(db: Kysely<any>): Promise<void> {
  // A chore or topic may be in no category. Removing a category leaves its tasks, ungrouped.
  for (const table of ["chores", "topics"]) {
    await sql`ALTER TABLE ${sql.table(table)} ALTER COLUMN category_id DROP NOT NULL`.execute(db);
    await sql`ALTER TABLE ${sql.table(table)} DROP CONSTRAINT ${sql.ref(`${table}_category_id_fkey`)}`.execute(db);
    await sql`
      ALTER TABLE ${sql.table(table)} ADD CONSTRAINT ${sql.ref(`${table}_category_id_fkey`)}
      FOREIGN KEY (category_id) REFERENCES task_categories(id) ON DELETE SET NULL
    `.execute(db);
    // A removed ("retired") task is no longer offered, but its tickets, history and stars stay.
    await db.schema.alterTable(table).addColumn("retired_at", "timestamptz").execute();
  }

  // Tickets keep their category for the record, but outlive it.
  await sql`ALTER TABLE tickets ALTER COLUMN category_id DROP NOT NULL`.execute(db);
  await sql`ALTER TABLE tickets DROP CONSTRAINT tickets_category_id_fkey`.execute(db);
  await sql`
    ALTER TABLE tickets ADD CONSTRAINT tickets_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES task_categories(id) ON DELETE SET NULL
  `.execute(db);

  // Each ticket records its kind, because the rule is now one open chore and one open quiz per child.
  await db.schema
    .alterTable("tickets")
    .addColumn("kind", "text", (col) => col.check(sql`kind in ('chore', 'quiz')`))
    .execute();
  await sql`UPDATE tickets SET kind = CASE WHEN chore_id IS NOT NULL THEN 'chore' ELSE 'quiz' END`.execute(db);
  await sql`ALTER TABLE tickets ALTER COLUMN kind SET NOT NULL`.execute(db);
  await sql`DROP INDEX tickets_one_open_per_category`.execute(db);
  await sql`
    CREATE UNIQUE INDEX tickets_one_open_per_kind ON tickets (child_id, kind)
    WHERE state IN ('open', 'handed-in')
  `.execute(db);

  // A category no longer has a kind: it's just a folder.
  await sql`ALTER TABLE task_categories ALTER COLUMN kind DROP NOT NULL`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX tickets_one_open_per_kind`.execute(db);
  await db.schema.alterTable("tickets").dropColumn("kind").execute();
  for (const table of ["chores", "topics"]) await db.schema.alterTable(table).dropColumn("retired_at").execute();
}
