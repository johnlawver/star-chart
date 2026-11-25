import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // A unit is one box that is both an observatory's printer and its scanner, paired once.
  await sql`alter table devices drop constraint devices_kind_check`.execute(db);
  await sql`alter table devices add constraint devices_kind_check check (kind in ('screen', 'printer', 'scanner', 'unit'))`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`delete from devices where kind = 'unit'`.execute(db);
  await sql`alter table devices drop constraint devices_kind_check`.execute(db);
  await sql`alter table devices add constraint devices_kind_check check (kind in ('screen', 'printer', 'scanner'))`.execute(db);
}
