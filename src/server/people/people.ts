import { hash, verify } from "@node-rs/argon2";
import { sql } from "kysely";
import type { Clock } from "../clock.js";
import type { Database, Role } from "../database.js";
import { hashToken, newToken } from "../tokens.js";
import { isId } from "../ids.js";
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

    /** Sets (or changes) a grown-up's PIN for unlocking the Control Center on an observatory. */
    async setPin(grownUpId: string, pin: string): Promise<void> {
      await db.updateTable("grown_ups").set({ pin_hash: await hash(pin) }).where("id", "=", grownUpId).execute();
    },

    /** The chart's grown-ups who have a PIN, as an observatory shows them: by the first part of their email. */
    async withPins(chartId: string): Promise<{ id: string; name: string }[]> {
      const grownUps = await db
        .selectFrom("grown_ups")
        .select(["id", "email"])
        .where("chart_id", "=", chartId)
        .where("pin_hash", "is not", null)
        .orderBy("email")
        .execute();
      return grownUps.map((grownUp) => ({ id: grownUp.id, name: grownUp.email.split("@")[0] ?? grownUp.email }));
    },

    /**
     * Checks a grown-up's PIN, entered on one of their chart's observatories. If it's right, returns a session token
     * that ends on its own after `lifetimeMs`. Undefined if the grown-up isn't in this chart or the PIN is wrong.
     */
    async unlockWithPin(input: {
      chartId: string;
      grownUpId: string;
      pin: string;
      lifetimeMs: number;
    }): Promise<string | undefined> {
      if (!isId(input.grownUpId)) return undefined;
      const grownUp = await db
        .selectFrom("grown_ups")
        .select(["id", "pin_hash"])
        .where("chart_id", "=", input.chartId)
        .where("id", "=", input.grownUpId)
        .executeTakeFirst();
      if (!grownUp?.pin_hash || !(await verify(grownUp.pin_hash, input.pin))) return undefined;
      const now = clock.now();
      return startSession(db, grownUp.id, now, new Date(now.getTime() + input.lifetimeMs));
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
        .where((eb) => eb.or([eb("sessions.expires_at", "is", null), eb("sessions.expires_at", ">", clock.now())]))
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

async function startSession(db: Database, grownUpId: string, now: Date, expiresAt: Date | null = null): Promise<string> {
  const token = newToken();
  await db
    .insertInto("sessions")
    .values({ token_hash: hashToken(token), grown_up_id: grownUpId, created_at: now, expires_at: expiresAt })
    .execute();
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


