import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // A redemption is a negative star movement with a note ("ice cream"), recorded by a grown-up.
  await db.schema
    .alterTable("star_movements")
    .addColumn("note", "text")
    .addColumn("recorded_by_grown_up_id", "uuid", (col) => col.references("grown_ups.id").onDelete("set null"))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("star_movements").dropColumn("note").dropColumn("recorded_by_grown_up_id").execute();
}
