import { useSyncExternalStore } from "react";
import { api, stored } from "../shared/api.js";
import { backoffMs } from "../shared/backoff.js";

// How the observatory talks to the server when it might not be there. The frame runs for weeks unattended: its Wi-Fi
// comes up after the page loads, and the server restarts for releases. Nothing here ever throws or gives up for good.

export interface Answer {
  ok: boolean;
  /** 0 when the server couldn't be reached at all. */
  status: number;
  data: any;
}

const cacheKey = (url: string) => `star-chart.observatory.last:${url}`;
const noAnswer: Answer = { ok: false, status: 0, data: undefined };

/** Couldn't reach the server, or the proxy in front of it says it's down (as while a new release starts). */
export function serverDown(status: number): boolean {
  return status === 0 || status === 502 || status === 503 || status === 504;
}

let reachable = true;
const listeners = new Set<() => void>();
function setReachable(now: boolean) {
  if (now === reachable) return;
  reachable = now;
  for (const listener of listeners) listener();
}

/** Whether the server answered the last time anything asked: false while the screen is showing out-of-date things. */
export function isReachable(): boolean {
  return reachable;
}

export function useReachable(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isReachable,
  );
}

/** Asks once. Never throws: an unreachable server is status 0. Every answer updates whether the server is reachable. */
export async function ask(method: string, url: string, body: unknown, deviceToken: string): Promise<Answer> {
  let answer: Answer;
  try {
    answer = await api(method, url, body, deviceToken);
  } catch {
    answer = noAnswer;
  }
  setReachable(!serverDown(answer.status));
  return answer;
}

/**
 * Asks until the server answers, waiting about 1 s, then 2, 4… up to 30 s between tries. Any real answer (even a
 * refusal) ends it. Resolves undefined if stopped first.
 */
export async function keepAsking(method: string, url: string, body: unknown, deviceToken: string, signal: AbortSignal): Promise<Answer | undefined> {
  for (let attempt = 0; !signal.aborted; attempt++) {
    const answer = await ask(method, url, body, deviceToken);
    if (signal.aborted) return undefined;
    if (!serverDown(answer.status)) return answer;
    await wait(backoffMs(attempt), signal);
  }
  return undefined;
}

/**
 * Loads something the screen shows, asking until the server answers. `use` gets the data: the last good copy straight
 * away if the server can't be reached (kept across reloads, so even a screen started offline has something to show),
 * then the fresh copy once it answers (`fresh` says which). Resolves with the final status (for noticing 401), or undefined if stopped.
 */
export async function keepLoading(url: string, deviceToken: string, signal: AbortSignal, use: (data: any, fresh: boolean) => void): Promise<number | undefined> {
  let showedLastGood = false;
  for (let attempt = 0; !signal.aborted; attempt++) {
    const answer = await ask("GET", url, undefined, deviceToken);
    if (signal.aborted) return undefined;
    if (answer.ok) {
      stored.set(cacheKey(url), JSON.stringify(answer.data));
      use(answer.data, true);
      return answer.status;
    }
    if (!serverDown(answer.status)) return answer.status;
    if (!showedLastGood) {
      showedLastGood = true;
      const lastGood = stored.get(cacheKey(url));
      if (lastGood !== undefined) use(JSON.parse(lastGood), false);
    }
    await wait(backoffMs(attempt), signal);
  }
  return undefined;
}

/** Forgets every remembered copy, for when this screen is unpaired: none of that chart's things should linger. */
export function forgetLastGood(): void {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(cacheKey(""))) localStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing was remembered.
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
  });
}
