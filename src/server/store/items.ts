import type { Database } from "../database.js";

export type StoreItemKind = "sticker" | "hat" | "hair";

/** One thing a store can sell. Its picture lives on the front end, found by id (see the art folder's manifest). */
export interface BuiltInItem {
  id: string;
  kind: StoreItemKind;
  name: string;
  price: number;
  /** Whether a new chart's store starts with it. The rest can be added later (ticket 08). */
  starting: boolean;
}

/** Every item a chart's store can sell, in the order a new store shows them. */
export const builtInItems: BuiltInItem[] = [
  { id: "rocket", kind: "sticker", name: "Rocket", price: 2, starting: true },
  { id: "moon", kind: "sticker", name: "Moon", price: 2, starting: true },
  { id: "planet", kind: "sticker", name: "Ringed planet", price: 3, starting: true },
  { id: "alien", kind: "sticker", name: "Friendly alien", price: 4, starting: true },
  { id: "comet", kind: "sticker", name: "Comet", price: 3, starting: true },
  { id: "crown", kind: "hat", name: "Crown", price: 6, starting: true },
  { id: "wizard", kind: "hat", name: "Wizard hat", price: 5, starting: true },
  { id: "helmet", kind: "hat", name: "Space helmet", price: 8, starting: true },
  { id: "spiky", kind: "hair", name: "Spiky hair", price: 4, starting: true },
  { id: "curly", kind: "hair", name: "Curly hair", price: 4, starting: true },
  { id: "ufo", kind: "sticker", name: "Flying saucer", price: 3, starting: false },
  { id: "astronaut", kind: "sticker", name: "Astronaut", price: 5, starting: false },
  { id: "telescope", kind: "sticker", name: "Telescope", price: 4, starting: false },
];

export function builtInItem(id: string): BuiltInItem | undefined {
  return builtInItems.find((item) => item.id === id);
}

/** Gives a new chart the starting store, inside the transaction that creates the chart. */
export async function addStartingStore(trx: Database, chartId: string): Promise<void> {
  await trx
    .insertInto("store_items")
    .values(
      builtInItems
        .filter((item) => item.starting)
        .map((item, position) => ({ chart_id: chartId, item_id: item.id, price: item.price, position })),
    )
    .execute();
}
