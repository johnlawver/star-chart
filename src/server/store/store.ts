import { randomBytes } from "node:crypto";
import { artFileUrl } from "../art-files/art-files.js";
import type { Clock } from "../clock.js";
import type { Database } from "../database.js";
import { isUniqueViolation } from "../database-errors.js";
import { isId } from "../ids.js";
import { balanceIn } from "../stars/stars.js";
import { builtInItem, builtInItems, type StoreItemKind } from "./items.js";

/** What the store sells for now. Outfits join when the mascot can wear them (ticket 09). */
const forSale: StoreItemKind[] = ["sticker"];

export interface StoreItem {
  id: string;
  kind: StoreItemKind;
  name: string;
  price: number;
  /** The uploaded picture's address, or null for a built-in item (its picture comes with the app). */
  art: string | null;
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
      .select(["item_id", "price", "name", "kind", "art_file_id"])
      .where("chart_id", "=", chartId)
      .orderBy("position")
      .execute();
    return rows.flatMap((row): StoreItem[] => {
      // The chart's own item, with its own name and uploaded picture.
      if (row.art_file_id && row.name && row.kind) {
        const kind = row.kind as StoreItemKind;
        return forSale.includes(kind) ? [{ id: row.item_id, kind, name: row.name, price: row.price, art: artFileUrl(row.art_file_id) }] : [];
      }
      const item = builtInItem(row.item_id);
      return item && forSale.includes(item.kind) ? [{ id: item.id, kind: item.kind, name: item.name, price: row.price, art: null }] : [];
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

  /** Puts an item at the end of the chart's store. False if it's already there. */
  async function append(chartId: string, row: { item_id: string; price: number; name?: string; kind?: string; art_file_id?: string }) {
    try {
      await db.transaction().execute(async (trx) => {
        const { last } = await trx
          .selectFrom("store_items")
          .select((eb) => eb.fn.max("position").as("last"))
          .where("chart_id", "=", chartId)
          .executeTakeFirstOrThrow();
        await trx
          .insertInto("store_items")
          .values({ chart_id: chartId, position: (last ?? -1) + 1, ...row })
          .execute();
      });
      return true;
    } catch (error) {
      if (isUniqueViolation(error, "store_items_one_per_chart")) return false;
      throw error;
    }
  }

  return {
    /** Adds an item from the built-in list to the chart's store, at its usual price unless given another. */
    async addBuiltIn(chartId: string, itemId: string, price?: number): Promise<"added" | "unknown" | "already-in-store"> {
      const item = builtInItem(itemId);
      if (!item) return "unknown";
      return (await append(chartId, { item_id: item.id, price: price ?? item.price })) ? "added" : "already-in-store";
    },

    /** Adds the chart's own sticker, with a picture uploaded to this chart, to the end of its store. */
    async addSticker(chartId: string, sticker: { name: string; price: number; artFileId: string }): Promise<{ id: string }> {
      const id = `sticker-${randomBytes(5).toString("hex")}`;
      await append(chartId, { item_id: id, price: sticker.price, name: sticker.name, kind: "sticker", art_file_id: sticker.artFileId });
      return { id };
    },

    /** The built-in items for sale that aren't in the chart's store yet, so a grown-up can add them. */
    async available(chartId: string): Promise<Omit<StoreItem, "art">[]> {
      const inStore = new Set((await db.selectFrom("store_items").select("item_id").where("chart_id", "=", chartId).execute()).map((row) => row.item_id));
      return builtInItems
        .filter((item) => forSale.includes(item.kind) && !inStore.has(item.id))
        .map(({ id, kind, name, price }) => ({ id, kind, name, price }));
    },

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
