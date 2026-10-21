import { hash, verify } from "@node-rs/argon2";
import { sql } from "kysely";
import type { Clock } from "../clock.js";
import type { Database, Role } from "../database.js";
import { hashToken, newToken } from "../tokens.js";
import { isId } from "../ids.js";
import { isUniqueViolation } from "../database-errors.js";

const phoneSetupCodeLifetimeMs = 5 * 60 * 1000;

/** Who each role may remove from a chart. Nobody removes the owner; the owner hands the chart over instead. */
const mayRemove: Record<Role, Role[]> = {
  owner: ["admin", "grown-up"],
  admin: ["grown-up"],
  "grown-up": [],
};
const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const passwordResetLifetimeMs = 60 * 60 * 1000;

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

    /** A single-use code, valid for 5 minutes, that signs a phone in as this grown-up. */
    async newPhoneSetupCode(grownUpId: string): Promise<{ code: string; expiresAt: Date }> {
      const code = newToken();
      const expiresAt = new Date(clock.now().getTime() + phoneSetupCodeLifetimeMs);
      await db
        .insertInto("phone_setup_codes")
        .values({ code_hash: hashToken(code), grown_up_id: grownUpId, expires_at: expiresAt })
        .execute();
      return { code, expiresAt };
    },

    /** Uses up a phone setup code and returns a lasting session for its grown-up, or undefined if it isn't valid. */
    async claimPhoneSetupCode(code: string): Promise<string | undefined> {
      return db.transaction().execute(async (trx) => {
        const used = await trx
          .deleteFrom("phone_setup_codes")
          .where("code_hash", "=", hashToken(code))
          .returning(["grown_up_id", "expires_at"])
          .executeTakeFirst();
        const now = clock.now();
        if (!used || used.expires_at <= now) return undefined;
        return startSession(trx, used.grown_up_id, now);
      });
    },

    /** Records an invitation to join a chart and returns the token for its emailed link (valid for 7 days). */
    async invite(input: { chartId: string; invitedBy: string; email: string }): Promise<string> {
      const token = newToken();
      const now = clock.now();
      await db
        .insertInto("invitations")
        .values({
          token_hash: hashToken(token),
          chart_id: input.chartId,
          email: input.email.trim(),
          invited_by_grown_up_id: input.invitedBy,
          expires_at: new Date(now.getTime() + invitationLifetimeMs),
          created_at: now,
        })
        .execute();
      return token;
    },

    /**
     * Uses up an invitation: creates the invited grown-up in its chart with the password they chose, and signs them in.
     * Refused if the invitation isn't valid, or its email already belongs to a chart (a person belongs to exactly one).
     */
    async acceptInvitation(
      token: string,
      password: string,
    ): Promise<{ token: string } | { refused: "invalid-invitation" | "email-in-use" }> {
      const passwordHash = await hash(password);
      return db
        .transaction()
        .execute(async (trx) => {
          const invitation = await trx
            .deleteFrom("invitations")
            .where("token_hash", "=", hashToken(token))
            .returning(["chart_id", "email", "expires_at"])
            .executeTakeFirst();
          const now = clock.now();
          if (!invitation || invitation.expires_at <= now) return { refused: "invalid-invitation" as const };
          const grownUp = await trx
            .insertInto("grown_ups")
            .values({
              chart_id: invitation.chart_id,
              email: invitation.email,
              password_hash: passwordHash,
              role: "grown-up",
              created_at: now,
            })
            .returning("id")
            .executeTakeFirstOrThrow();
          return { token: await startSession(trx, grownUp.id, now) };
        })
        .catch((error: unknown) => {
          if (isUniqueViolation(error, "grown_ups_email_unique")) return { refused: "email-in-use" as const };
          throw error;
        });
    },

    /** Everyone in a chart who has a login, and their role. */
    async grownUpsIn(chartId: string): Promise<{ id: string; email: string; role: Role }[]> {
      return db
        .selectFrom("grown_ups")
        .select(["id", "email", "role"])
        .where("chart_id", "=", chartId)
        .orderBy("created_at")
        .execute();
    },

    /**
     * Makes a grown-up an admin, or back to a plain grown-up. The owner's own role can't change this way:
     * ownership is handed over instead. Refused if there's no such grown-up in this chart.
     */
    async setRole(
      chartId: string,
      grownUpId: string,
      role: "admin" | "grown-up",
    ): Promise<{ id: string; role: Role } | { refused: "no-such-grown-up" | "is-owner" }> {
      if (!isId(grownUpId)) return { refused: "no-such-grown-up" };
      const grownUp = await db
        .selectFrom("grown_ups")
        .select("role")
        .where("chart_id", "=", chartId)
        .where("id", "=", grownUpId)
        .executeTakeFirst();
      if (!grownUp) return { refused: "no-such-grown-up" };
      if (grownUp.role === "owner") return { refused: "is-owner" };
      return db
        .updateTable("grown_ups")
        .set({ role })
        .where("id", "=", grownUpId)
        .returning(["id", "role"])
        .executeTakeFirstOrThrow();
    },

    /** A token for an hour-long password reset link, or undefined if no grown-up has this email. */
    async requestPasswordReset(email: string): Promise<string | undefined> {
      const grownUp = await db
        .selectFrom("grown_ups")
        .select("id")
        .where(sql`lower(email)`, "=", email.trim().toLowerCase())
        .executeTakeFirst();
      if (!grownUp) return undefined;
      const token = newToken();
      await db
        .insertInto("password_resets")
        .values({
          token_hash: hashToken(token),
          grown_up_id: grownUp.id,
          expires_at: new Date(clock.now().getTime() + passwordResetLifetimeMs),
        })
        .execute();
      return token;
    },

    /**
     * Uses up a reset link: sets the new password, signs the grown-up out everywhere (whoever knew the old password
     * shouldn't stay signed in), and returns a fresh session. Undefined if the link isn't valid.
     */
    async completePasswordReset(token: string, password: string): Promise<string | undefined> {
      const passwordHash = await hash(password);
      return db.transaction().execute(async (trx) => {
        const reset = await trx
          .deleteFrom("password_resets")
          .where("token_hash", "=", hashToken(token))
          .returning(["grown_up_id", "expires_at"])
          .executeTakeFirst();
        const now = clock.now();
        if (!reset || reset.expires_at <= now) return undefined;
        await trx.updateTable("grown_ups").set({ password_hash: passwordHash }).where("id", "=", reset.grown_up_id).execute();
        await trx.deleteFrom("sessions").where("grown_up_id", "=", reset.grown_up_id).execute();
        return startSession(trx, reset.grown_up_id, now);
      });
    },

    /** The owner hands the chart to one of its admins, and becomes an admin. */
    async transferOwnership(
      chartId: string,
      ownerId: string,
      newOwnerId: string,
    ): Promise<{ ok: true } | { refused: "no-such-grown-up" | "not-an-admin" }> {
      if (!isId(newOwnerId)) return { refused: "no-such-grown-up" };
      return db.transaction().execute(async (trx) => {
        const newOwner = await trx
          .selectFrom("grown_ups")
          .select("role")
          .where("chart_id", "=", chartId)
          .where("id", "=", newOwnerId)
          .forUpdate()
          .executeTakeFirst();
        if (!newOwner) return { refused: "no-such-grown-up" as const };
        if (newOwner.role !== "admin") return { refused: "not-an-admin" as const };
        await trx.updateTable("grown_ups").set({ role: "admin" }).where("id", "=", ownerId).execute();
        await trx.updateTable("grown_ups").set({ role: "owner" }).where("id", "=", newOwnerId).execute();
        return { ok: true as const };
      });
    },

    /**
     * Removes a grown-up from the chart, deleting their login (and with it their sessions, devices and codes).
     * What they did stays on record, shown as "a former grown-up".
     */
    async remove(
      chartId: string,
      by: { id: string; role: Role },
      grownUpId: string,
    ): Promise<{ ok: true } | { refused: "no-such-grown-up" | "not-allowed" | "is-yourself" }> {
      if (!isId(grownUpId)) return { refused: "no-such-grown-up" };
      if (grownUpId === by.id) return { refused: "is-yourself" };
      const target = await db
        .selectFrom("grown_ups")
        .select("role")
        .where("chart_id", "=", chartId)
        .where("id", "=", grownUpId)
        .executeTakeFirst();
      if (!target) return { refused: "no-such-grown-up" };
      if (!mayRemove[by.role].includes(target.role)) return { refused: "not-allowed" };
      await db.deleteFrom("grown_ups").where("id", "=", grownUpId).execute();
      return { ok: true };
    },

    /** A grown-up leaves their chart, deleting their login. The owner must hand the chart over first. */
    async leave(grownUp: { id: string; role: Role }): Promise<{ ok: true } | { refused: "is-owner" }> {
      if (grownUp.role === "owner") return { refused: "is-owner" };
      await db.deleteFrom("grown_ups").where("id", "=", grownUp.id).execute();
      return { ok: true };
    },

    /** Permanently deletes a chart and everything in it: grown-ups, children, tickets, stars, observatories, devices. */
    async deleteChart(chartId: string): Promise<void> {
      await db.deleteFrom("charts").where("id", "=", chartId).execute();
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


