import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // A subject within a quiz category, such as Addition within Math. May come with a built-in sample set.
  await db.schema
    .createTable("topics")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("category_id", "uuid", (col) => col.notNull().references("task_categories.id").onDelete("cascade"))
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("stars", "integer", (col) => col.notNull().check(sql`stars >= 0`))
    .addColumn("icon", "text")
    .addColumn("samples", "text", (col) =>
      col.check(sql`samples in ('addition', 'subtraction', 'letters', 'numbers', 'spelling')`),
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();

  // Which children have a topic switched on, and at what level.
  await db.schema
    .createTable("topic_children")
    .addColumn("topic_id", "uuid", (col) => col.notNull().references("topics.id").onDelete("cascade"))
    .addColumn("child_id", "uuid", (col) => col.notNull().references("children.id").onDelete("cascade"))
    .addColumn("level", "integer", (col) => col.notNull().check(sql`level >= 1`))
    .addPrimaryKeyConstraint("topic_children_pk", ["topic_id", "child_id"])
    .execute();

  // A quiz in a child's pool for one topic and level: structured items (prompt and answer), so it prints the same
  // way whoever wrote it (a grown-up, a built-in sample set, or the quiz feed, which gives it its own external id).
  await db.schema
    .createTable("quizzes")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("chart_id", "uuid", (col) => col.notNull().references("charts.id").onDelete("cascade"))
    .addColumn("child_id", "uuid", (col) => col.notNull().references("children.id").onDelete("cascade"))
    .addColumn("topic_id", "uuid", (col) => col.notNull().references("topics.id").onDelete("cascade"))
    .addColumn("level", "integer", (col) => col.notNull())
    .addColumn("external_id", "text")
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("instructions", "text", (col) => col.notNull())
    .addColumn("items", "jsonb", (col) => col.notNull())
    .addColumn("state", "text", (col) => col.notNull().check(sql`state in ('pooled', 'printed', 'withdrawn')`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addColumn("printed_at", "timestamptz")
    .execute();
  await sql`CREATE UNIQUE INDEX quizzes_external_id ON quizzes (chart_id, external_id) WHERE external_id IS NOT NULL`.execute(db);
  await db.schema.createIndex("quizzes_pool").on("quizzes").columns(["child_id", "topic_id", "level", "state"]).execute();

  // How many quizzes the quiz feed keeps in each pool.
  await db.schema.alterTable("charts").addColumn("quiz_pool_target", "integer", (col) => col.notNull().defaultTo(5)).execute();

  // A quiz ticket's content comes from its quiz; a grown-up may record a score when approving it.
  await db.schema
    .alterTable("tickets")
    .addColumn("quiz_id", "uuid", (col) => col.references("quizzes.id").onDelete("cascade"))
    .addColumn("topic_id", "uuid", (col) => col.references("topics.id").onDelete("cascade"))
    .addColumn("score_correct", "integer")
    .addColumn("score_out_of", "integer")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("tickets")
    .dropColumn("quiz_id")
    .dropColumn("topic_id")
    .dropColumn("score_correct")
    .dropColumn("score_out_of")
    .execute();
  await db.schema.alterTable("charts").dropColumn("quiz_pool_target").execute();
  await db.schema.dropTable("quizzes").execute();
  await db.schema.dropTable("topic_children").execute();
  await db.schema.dropTable("topics").execute();
}
