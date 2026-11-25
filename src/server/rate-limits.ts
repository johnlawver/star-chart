import type { FastifyReply } from "fastify";
import type { Clock } from "./clock.js";

// The server is on the public internet. Anything that can be guessed (a password, a code, a link) or that sends an
// email can only be tried so often, counted per account and per internet address. Counts are kept in memory: a restart
// forgets them, which is fine for a single server, and nothing about anyone is written down.

const minutes = (n: number) => n * 60_000;

/** How many tries are allowed in a window. A window starts at the first try and lasts its full length. */
export const limits = {
  /** Wrong passwords for one account, from anywhere. */
  wrongPasswordsPerAccount: { tries: 10, windowMs: minutes(15) },
  /** Wrong passwords from one address, for any accounts. */
  wrongPasswordsPerAddress: { tries: 30, windowMs: minutes(15) },
  /** Wrong codes and links from one address: pairing codes, phone setup codes, invitations, password resets. */
  wrongCodesPerAddress: { tries: 20, windowMs: minutes(15) },
  /** Password-reset emails to one account. */
  resetEmailsPerAccount: { tries: 3, windowMs: minutes(60) },
  /** Password-reset requests from one address. */
  resetRequestsPerAddress: { tries: 10, windowMs: minutes(60) },
  /** Pairing codes made by one grown-up. */
  pairingCodesPerGrownUp: { tries: 20, windowMs: minutes(60) },
  /** New charts from one address. */
  signUpsPerAddress: { tries: 5, windowMs: minutes(60) },
} as const;

export type Limit = keyof typeof limits;

/** Prune finished windows once this many are being kept. */
const pruneAbove = 10_000;

export function createRateLimits(clock: Clock, enabled = true) {
  const windows = new Map<string, { tries: number; endsAt: number }>();

  const current = (limit: Limit, who: string) => {
    const window = windows.get(`${limit}:${who.toLowerCase()}`);
    return window && window.endsAt > clock.now().getTime() ? window : undefined;
  };

  return {
    /** Seconds until `who` may try again, or undefined if they may try now. */
    waitFor(limit: Limit, who: string): number | undefined {
      if (!enabled) return undefined;
      const window = current(limit, who);
      if (!window || window.tries < limits[limit].tries) return undefined;
      return Math.ceil((window.endsAt - clock.now().getTime()) / 1000);
    },

    /** Counts a try (a wrong guess, an email asked for) against `who`. */
    count(limit: Limit, who: string): void {
      const now = clock.now().getTime();
      const window = current(limit, who);
      if (window) {
        window.tries++;
        return;
      }
      if (windows.size >= pruneAbove) {
        for (const [key, old] of windows) if (old.endsAt <= now) windows.delete(key);
      }
      windows.set(`${limit}:${who.toLowerCase()}`, { tries: 1, endsAt: now + limits[limit].windowMs });
    },

    /**
     * Refuses the request (429, saying when to try again) if any of the given limits has been reached, and says
     * whether it did. Used at the top of a route: `if (rateLimits.refuse(reply, [...])) return reply;`
     */
    refuse(reply: FastifyReply, checks: [Limit, string][]): boolean {
      const waits = checks.map(([limit, who]) => this.waitFor(limit, who)).filter((wait) => wait !== undefined);
      if (waits.length === 0) return false;
      void reply
        .code(429)
        .header("retry-after", String(Math.max(...waits)))
        .send({ error: "Too many tries. Wait a few minutes, then try again." });
      return true;
    },
  };
}

export type RateLimits = ReturnType<typeof createRateLimits>;
