import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // How often a chore can earn stars: so many times per day (the default being once) or per week.
  await db.schema
    .alterTable("chores")
    .addColumn("frequency_times", "integer", (col) => col.notNull().defaultTo(1).check(sql`frequency_times >= 1`))
    .addColumn("frequency_per", "text", (col) => col.notNull().defaultTo("day").check(sql`frequency_per in ('day', 'week')`))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("chores").dropColumn("frequency_times").dropColumn("frequency_per").execute();
}
