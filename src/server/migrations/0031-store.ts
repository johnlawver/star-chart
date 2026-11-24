import { sql, type Kysely } from "kysely";

// The starting store as it was when this migration was written. Migrations never change, so this is a copy, not an
// import of the live list.
const startingStore = [
  ["rocket", 2], ["moon", 2], ["planet", 3], ["alien", 4], ["comet", 3],
  ["crown", 6], ["wizard", 5], ["helmet", 8], ["spiky", 4], ["curly", 4],
] as const;

export async function up(db: Kysely<any>): Promise<void> {
  // Each chart's store: which built-in items it sells, at what price, in what order.
  await db.schema
    .createTable("store_items")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("chart_id", "uuid", (col) => col.notNull().references("charts.id").onDelete("cascade"))
    .addColumn("item_id", "text", (col) => col.notNull())
    .addColumn("price", "integer", (col) => col.notNull().check(sql`price > 0`))
    .addColumn("position", "integer", (col) => col.notNull())
    .addUniqueConstraint("store_items_one_per_chart", ["chart_id", "item_id"])
    .execute();

  // What a child bought. Its stars are a spending in star_movements, recorded in the same transaction.
  await db.schema
    .createTable("purchases")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("chart_id", "uuid", (col) => col.notNull().references("charts.id").onDelete("cascade"))
    .addColumn("child_id", "uuid", (col) => col.notNull().references("children.id").onDelete("cascade"))
    .addColumn("item_id", "text", (col) => col.notNull())
    .addColumn("price", "integer", (col) => col.notNull())
    .addColumn("star_movement_id", "uuid", (col) => col.notNull().references("star_movements.id").onDelete("cascade"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addUniqueConstraint("purchases_each_item_once", ["child_id", "item_id"])
    .execute();

  // Every chart that already exists gets the starting store.
  for (const [position, [itemId, price]] of startingStore.entries()) {
    await sql`insert into store_items (chart_id, item_id, price, position)
      select id, ${itemId}, ${price}, ${position} from charts`.execute(db);
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("purchases").execute();
  await db.schema.dropTable("store_items").execute();
}
