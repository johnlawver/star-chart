import { hash, verify } from "@node-rs/argon2";
import { sql } from "kysely";
import type { Clock } from "../clock.js";
import type { Database, Role } from "../database.js";
import { hashToken, newToken } from "../tokens.js";
import { isUniqueViolation } from "../database-errors.js";

/** The charts-and-people module: charts, grown-ups and their sessions. */
export interface SignedInGrownUp {
  grownUp: { id: string; email: string; role: Role };
  chart: { id: string; name: string; timeZone: string };
}

export function createPeople(db: Database, clock: Clock) {
  return {
    /** Creates a chart with the signing-up grown-up as its owner, and returns a new session token. */
    async signUp(input: {
      email: string;
      password: string;
      chartName: string;
      timeZone: string;
    }): Promise<{ token: string } | { refused: "email-in-use" | "unknown-time-zone" }> {
      if (!isTimeZone(input.timeZone)) return { refused: "unknown-time-zone" };
      const passwordHash = await hash(input.password);
      const token = await db.transaction().execute(async (trx) => {
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
        return startSession(trx, grownUp.id, now);
      }).catch((error: unknown) => {
        if (isUniqueViolation(error, "grown_ups_email_unique")) return undefined;
        throw error;
      });
      return token === undefined ? { refused: "email-in-use" } : { token };
    },

    /** Returns a new session token, or undefined if the email and password don't match a grown-up. */
    async signIn(input: { email: string; password: string }): Promise<string | undefined> {
      const grownUp = await db
        .selectFrom("grown_ups")
        .select(["id", "password_hash"])
        .where(sql`lower(email)`, "=", input.email.toLowerCase())
        .executeTakeFirst();
      if (!grownUp || !(await verify(grownUp.password_hash, input.password))) return undefined;
      return startSession(db, grownUp.id, clock.now());
    },

    async signOut(token: string): Promise<void> {
      await db.deleteFrom("sessions").where("token_hash", "=", hashToken(token)).execute();
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

async function startSession(db: Database, grownUpId: string, now: Date): Promise<string> {
  const token = newToken();
  await db.insertInto("sessions").values({ token_hash: hashToken(token), grown_up_id: grownUpId, created_at: now }).execute();
  return token;
}

function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}


