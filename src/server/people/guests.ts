import { randomInt } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import type { Clock } from "../clock.js";
import type { Database } from "../database.js";
import { isId } from "../ids.js";
import { hashToken, newToken } from "../tokens.js";

const defaultGuestPinHours = 12;

/** A guest (a babysitter) signed in on an observatory with a Guest PIN. They can only handle tickets. */
export interface SignedInGuest {
  guest: { pinId: string };
  chart: { id: string; name: string; timeZone: string };
}

/** Guest PINs: made by any grown-up, short-lived, anonymous, and only good for handling tickets. */
export function createGuests(db: Database, clock: Clock) {
  /** The chart's Guest PINs that work right now. */
  async function activePins(chartId: string) {
    return db
      .selectFrom("guest_pins")
      .select(["id", "pin_hash", "expires_at"])
      .where("chart_id", "=", chartId)
      .where("cancelled_at", "is", null)
      .where("expires_at", ">", clock.now())
      .execute();
  }

  return {
    /**
     * Makes a Guest PIN. The server picks the 6 digits (so nobody chooses "1234" for the babysitter), avoiding any
     * other PIN that's active in the chart. It's shown this once.
     */
    async create(input: {
      chartId: string;
      createdBy: string;
      label?: string;
      hours?: number;
    }): Promise<{ id: string; pin: string; expiresAt: Date }> {
      const active = await activePins(input.chartId);
      let pin: string;
      do {
        pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
      } while ((await Promise.all(active.map((p) => verify(p.pin_hash, pin)))).some(Boolean));
      const now = clock.now();
      const expiresAt = new Date(now.getTime() + (input.hours ?? defaultGuestPinHours) * 60 * 60 * 1000);
      const created = await db
        .insertInto("guest_pins")
        .values({
          chart_id: input.chartId,
          pin_hash: await hash(pin),
          label: input.label?.trim() || null,
          created_by_grown_up_id: input.createdBy,
          expires_at: expiresAt,
          created_at: now,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      return { id: created.id, pin, expiresAt };
    },

    /**
     * Checks a Guest PIN entered on one of the chart's observatories. If it's right, returns a session token that ends
     * after `lifetimeMs`, or when the PIN does if that's sooner. Undefined if no active Guest PIN matches.
     */
    async unlock(chartId: string, pin: string, lifetimeMs: number): Promise<string | undefined> {
      for (const active of await activePins(chartId)) {
        if (!(await verify(active.pin_hash, pin))) continue;
        const token = newToken();
        const ends = Math.min(clock.now().getTime() + lifetimeMs, active.expires_at.getTime());
        await db
          .insertInto("guest_sessions")
          .values({ token_hash: hashToken(token), guest_pin_id: active.id, expires_at: new Date(ends) })
          .execute();
        return token;
      }
      return undefined;
    },

    /** Who a session token belongs to, if it's a guest whose PIN still works. */
    async whoIs(token: string): Promise<SignedInGuest | undefined> {
      const now = clock.now();
      const row = await db
        .selectFrom("guest_sessions")
        .innerJoin("guest_pins", "guest_pins.id", "guest_sessions.guest_pin_id")
        .innerJoin("charts", "charts.id", "guest_pins.chart_id")
        .select(["guest_pins.id as pinId", "charts.id as chartId", "charts.name", "charts.time_zone"])
        .where("guest_sessions.token_hash", "=", hashToken(token))
        .where("guest_sessions.expires_at", ">", now)
        .where("guest_pins.expires_at", ">", now)
        .where("guest_pins.cancelled_at", "is", null)
        .executeTakeFirst();
      if (!row) return undefined;
      return { guest: { pinId: row.pinId }, chart: { id: row.chartId, name: row.name, timeZone: row.time_zone } };
    },

    async signOut(token: string): Promise<void> {
      await db.deleteFrom("guest_sessions").where("token_hash", "=", hashToken(token)).execute();
    },

    /** The chart's Guest PINs that haven't expired or been cancelled. */
    async list(chartId: string) {
      const pins = await db
        .selectFrom("guest_pins")
        .select(["id", "label", "expires_at"])
        .where("chart_id", "=", chartId)
        .where("cancelled_at", "is", null)
        .where("expires_at", ">", clock.now())
        .orderBy("created_at")
        .execute();
      return pins.map((pin) => ({ id: pin.id, label: pin.label, expiresAt: pin.expires_at.toISOString() }));
    },

    /** Cancels a Guest PIN early, which also ends any guest session it opened. */
    async cancel(chartId: string, pinId: string): Promise<boolean> {
      if (!isId(pinId)) return false;
      const result = await db
        .updateTable("guest_pins")
        .set({ cancelled_at: clock.now() })
        .where("chart_id", "=", chartId)
        .where("id", "=", pinId)
        .where("cancelled_at", "is", null)
        .executeTakeFirst();
      if (result.numUpdatedRows === 0n) return false;
      await db.deleteFrom("guest_sessions").where("guest_pin_id", "=", pinId).execute();
      return true;
    },
  };
}

export type Guests = ReturnType<typeof createGuests>;
