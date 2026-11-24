import type { Clock } from "../clock.js";
import type { Database } from "../database.js";
import { isUniqueViolation } from "../database-errors.js";
import { isId } from "../ids.js";
import { balanceIn } from "../stars/stars.js";
import { builtInItem, type StoreItemKind } from "./items.js";

/** What the store sells for now. Outfits join when the mascot can wear them (ticket 09). */
const forSale: StoreItemKind[] = ["sticker"];

export interface StoreItem {
  id: string;
  kind: StoreItemKind;
  name: string;
  price: number;
}

/** What a child owns, and what their mascot is wearing. */
export interface Wardrobe {
  owned: string[];
  wearing: { hat: string | null; hair: string | null };
}

export type PurchaseOutcome =
  | { balance: number; wardrobe: Wardrobe }
  | { refused: "not-found" }
  | { refused: "already-owned" }
  | { refused: "not-enough-stars"; balance: number };

/** The store module: each chart's store, and what children buy from it with their stars. */
export function createStore(db: Database, clock: Clock) {
  async function itemsFor(trx: Database, chartId: string): Promise<StoreItem[]> {
    const rows = await trx
      .selectFrom("store_items")
      .select(["item_id", "price"])
      .where("chart_id", "=", chartId)
      .orderBy("position")
      .execute();
    return rows.flatMap((row) => {
      const item = builtInItem(row.item_id);
      return item && forSale.includes(item.kind) ? [{ id: item.id, kind: item.kind, name: item.name, price: row.price }] : [];
    });
  }

  async function wardrobeIn(trx: Database, chartId: string, childId: string): Promise<Wardrobe> {
    const owned = await trx
      .selectFrom("purchases")
      .select("item_id")
      .where("chart_id", "=", chartId)
      .where("child_id", "=", childId)
      .orderBy("created_at")
      .execute();
    return { owned: owned.map((row) => row.item_id), wearing: { hat: null, hair: null } };
  }

  return {
    /** The chart's store, in order. */
    list: (chartId: string) => itemsFor(db, chartId),

    /** What a child owns and wears. */
    wardrobe: (chartId: string, childId: string) => wardrobeIn(db, chartId, childId),

    /**
     * A child buys an item from their chart's store with their stars. No grown-up needed. Each item once, and never
     * more than their balance: the child is locked while it's checked, like a redemption.
     */
    async buy(chartId: string, childId: string, itemId: string): Promise<PurchaseOutcome> {
      if (!isId(childId)) return { refused: "not-found" };
      try {
        return await db.transaction().execute(async (trx) => {
          const child = await trx
            .selectFrom("children")
            .select("id")
            .where("chart_id", "=", chartId)
            .where("id", "=", childId)
            .forUpdate()
            .executeTakeFirst();
          const item = (await itemsFor(trx, chartId)).find((candidate) => candidate.id === itemId);
          if (!child || !item) return { refused: "not-found" as const };
          const owned = await trx
            .selectFrom("purchases")
            .select("id")
            .where("child_id", "=", childId)
            .where("item_id", "=", itemId)
            .executeTakeFirst();
          if (owned) return { refused: "already-owned" as const };
          const balance = await balanceIn(trx, chartId, childId);
          if (item.price > balance) return { refused: "not-enough-stars" as const, balance };
          const now = clock.now();
          const spent = await trx
            .insertInto("star_movements")
            .values({
              chart_id: chartId,
              child_id: childId,
              amount: -item.price,
              ticket_id: null,
              note: `Bought: ${item.name}`,
              recorded_by_grown_up_id: null,
              created_at: now,
            })
            .returning("id")
            .executeTakeFirstOrThrow();
          await trx
            .insertInto("purchases")
            .values({ chart_id: chartId, child_id: childId, item_id: itemId, price: item.price, star_movement_id: spent.id, created_at: now })
            .execute();
          return { balance: balance - item.price, wardrobe: await wardrobeIn(trx, chartId, childId) };
        });
      } catch (error) {
        if (isUniqueViolation(error, "purchases_each_item_once")) return { refused: "already-owned" };
        throw error;
      }
    },
  };
}

export type Store = ReturnType<typeof createStore>;
