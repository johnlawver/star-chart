import type { Clock } from "../clock.js";
import type { Database, DeviceKind } from "../database.js";
import { isId } from "../ids.js";
import { hashToken, newPairingCode, newToken } from "../tokens.js";

const pairingCodeLifetimeMs = 10 * 60 * 1000;

/** A paired device, as identified by its credential. */
export interface PairedDevice {
  deviceId: string;
  kind: DeviceKind;
  observatoryId: string;
  chartId: string;
}

/** The observatories-and-devices module: observatories, their parts, and how they pair. */
export function createObservatories(db: Database, clock: Clock) {
  return {
    /** Creates an observatory in a chart and returns the credential for its screen. */
    async pair(chartId: string): Promise<{ observatoryId: string; deviceToken: string }> {
      return db.transaction().execute(async (trx) => {
        const now = clock.now();
        const observatory = await trx
          .insertInto("observatories")
          .values({ chart_id: chartId, created_at: now })
          .returning("id")
          .executeTakeFirstOrThrow();
        const deviceToken = newToken();
        await trx
          .insertInto("devices")
          .values({ observatory_id: observatory.id, kind: "screen", token_hash: hashToken(deviceToken), created_at: now })
          .execute();
        return { observatoryId: observatory.id, deviceToken };
      });
    },

    /** A new single-use code that lets a printer or scanner join this observatory for the next 10 minutes. */
    async newPairingCode(observatoryId: string): Promise<{ code: string; expiresAt: Date }> {
      const code = newPairingCode();
      const expiresAt = new Date(clock.now().getTime() + pairingCodeLifetimeMs);
      await db
        .insertInto("pairing_codes")
        .values({ code_hash: hashToken(code), observatory_id: observatoryId, expires_at: expiresAt })
        .execute();
      return { code, expiresAt };
    },

    /** Pairs a printer or scanner using a pairing code. Undefined if the code isn't valid. */
    async pairPart(code: string, kind: "printer" | "scanner"): Promise<{ deviceToken: string } | undefined> {
      return db.transaction().execute(async (trx) => {
        const now = clock.now();
        const used = await trx
          .deleteFrom("pairing_codes")
          .where("code_hash", "=", hashToken(code.trim().toUpperCase()))
          .returning(["observatory_id", "expires_at"])
          .executeTakeFirst();
        if (!used || used.expires_at <= now) return undefined;
        const deviceToken = newToken();
        await trx
          .insertInto("devices")
          .values({ observatory_id: used.observatory_id, kind, token_hash: hashToken(deviceToken), created_at: now })
          .execute();
        return { deviceToken };
      });
    },

    /** A chart's observatories and the parts (devices) paired to each. */
    async list(chartId: string): Promise<{ id: string; parts: { deviceId: string; kind: DeviceKind }[] }[]> {
      const rows = await db
        .selectFrom("observatories")
        .leftJoin("devices", "devices.observatory_id", "observatories.id")
        .select(["observatories.id", "observatories.created_at", "devices.id as deviceId", "devices.kind"])
        .where("observatories.chart_id", "=", chartId)
        .orderBy("observatories.created_at")
        .orderBy("devices.kind")
        .execute();
      const observatories = new Map<string, { id: string; parts: { deviceId: string; kind: DeviceKind }[] }>();
      for (const row of rows) {
        const observatory = observatories.get(row.id) ?? { id: row.id, parts: [] };
        if (row.deviceId && row.kind) observatory.parts.push({ deviceId: row.deviceId, kind: row.kind });
        observatories.set(row.id, observatory);
      }
      return [...observatories.values()];
    },

    /**
     * Removes an observatory from its chart. Its devices and pairing codes go with it, so every credential
     * it had stops working. Returns false if there's no such observatory in this chart.
     */
    async unpair(chartId: string, observatoryId: string): Promise<boolean> {
      if (!isId(observatoryId)) return false;
      const result = await db
        .deleteFrom("observatories")
        .where("chart_id", "=", chartId)
        .where("id", "=", observatoryId)
        .executeTakeFirst();
      return result.numDeletedRows > 0n;
    },

    /** The device a credential belongs to, or undefined if it isn't a valid credential. */
    async deviceFor(token: string): Promise<PairedDevice | undefined> {
      return db
        .selectFrom("devices")
        .innerJoin("observatories", "observatories.id", "devices.observatory_id")
        .select([
          "devices.id as deviceId",
          "devices.kind",
          "observatories.id as observatoryId",
          "observatories.chart_id as chartId",
        ])
        .where("devices.token_hash", "=", hashToken(token))
        .executeTakeFirst();
    },
  };
}

export type Observatories = ReturnType<typeof createObservatories>;
