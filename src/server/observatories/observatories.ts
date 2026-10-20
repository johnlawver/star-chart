import type { Clock } from "../clock.js";
import type { Database, DeviceKind } from "../database.js";
import { hashToken, newToken } from "../tokens.js";

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
