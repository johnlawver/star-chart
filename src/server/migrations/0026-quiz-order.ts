import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Quizzes written at the same moment (say, a batch from the quiz feed) still print in the order they arrived.
  await sql`ALTER TABLE quizzes ADD COLUMN seq bigint GENERATED ALWAYS AS IDENTITY`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("quizzes").dropColumn("seq").execute();
}
