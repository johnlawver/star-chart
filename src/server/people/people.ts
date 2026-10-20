import { createHash, randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import type { Clock } from "../clock.js";
import type { Database, Role } from "../database.js";

/** The charts-and-people module: charts, grown-ups and their sessions. */
export interface SignedInGrownUp {
  grownUp: { id: string; email: string; role: Role };
  chart: { id: string; name: string; timeZone: string };
}

export function createPeople(db: Database, clock: Clock) {
  return {
    /** Creates a chart with the signing-up grown-up as its owner, and returns a new session token. */
    async signUp(input: { email: string; password: string; chartName: string; timeZone: string }): Promise<string> {
      const passwordHash = await hash(input.password);
      return db.transaction().execute(async (trx) => {
        const now = clock.now();
        const chart = await trx
          .insertInto("charts")
          .values({ name: input.chartName, time_zone: input.timeZone, created_at: now })
          .returning("id")
          .executeTakeFirstOrThrow();
        const grownUp = await trx
          .insertInto("grown_ups")
          .values({
            chart_id: chart.id,
            email: input.email,
            password_hash: passwordHash,
            role: "owner",
            created_at: now,
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        const token = randomBytes(32).toString("base64url");
        await trx
          .insertInto("sessions")
          .values({ token_hash: hashToken(token), grown_up_id: grownUp.id, created_at: now })
          .execute();
        return token;
      });
    },

    /** Who a session token belongs to, or undefined if it isn't a valid session. */
    async whoIs(token: string): Promise<SignedInGrownUp | undefined> {
      const row = await db
        .selectFrom("sessions")
        .innerJoin("grown_ups", "grown_ups.id", "sessions.grown_up_id")
        .innerJoin("charts", "charts.id", "grown_ups.chart_id")
        .select([
          "grown_ups.id as grownUpId",
          "grown_ups.email",
          "grown_ups.role",
          "charts.id as chartId",
          "charts.name as chartName",
          "charts.time_zone as timeZone",
        ])
        .where("sessions.token_hash", "=", hashToken(token))
        .executeTakeFirst();
      if (!row) return undefined;
      return {
        grownUp: { id: row.grownUpId, email: row.email, role: row.role },
        chart: { id: row.chartId, name: row.chartName, timeZone: row.timeZone },
      };
    },
  };
}

export type People = ReturnType<typeof createPeople>;

// Only a hash of each session token is stored, so a leaked database can't be used to sign in.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}
