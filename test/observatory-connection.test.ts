import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { backoffMs } from "../src/web/shared/backoff.js";
import { isReachable, keepAsking, keepLoading } from "../src/web/observatory/connection.js";

// The observatory's own side of talking to a server that might not be there, with fetch and storage swapped for
// stand-ins and time moved by hand.

/** A stand-in fetch that fails (can't connect) for the first `failures` calls, then answers with `body`. */
function serverBackAfter(failures: number, body: unknown = { children: [] }, status = 200) {
  const calls: number[] = [];
  vi.stubGlobal("fetch", async () => {
    calls.push(Date.now());
    if (calls.length <= failures) throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  });
  return calls;
}

function storageStandIn() {
  const items = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  });
}

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
  storageStandIn();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("waiting between tries", () => {
  test("starts at about a second and doubles, never more than 30 seconds", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 20].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
});

describe("asking until the server answers", () => {
  test("a server that's away for a while is asked again, waiting longer each time, and its answer comes through", async () => {
    const calls = serverBackAfter(3);

    const answer = keepAsking("GET", "/api/observatory/children", undefined, "token", new AbortController().signal);
    await vi.runAllTimersAsync();

    expect(await answer).toMatchObject({ ok: true, status: 200 });
    expect(calls).toEqual([0, 1000, 3000, 7000]);
    expect(isReachable()).toBe(true);
  });

  test("a real refusal is an answer: it isn't asked again", async () => {
    const calls = serverBackAfter(0, { error: "not enough stars" }, 409);

    const answer = await keepAsking("POST", "/api/x", {}, "token", new AbortController().signal);

    expect(answer).toMatchObject({ ok: false, status: 409 });
    expect(calls).toHaveLength(1);
  });

  test("stopping (the screen moved on) ends the asking", async () => {
    const calls = serverBackAfter(100);
    const stop = new AbortController();

    const answer = keepAsking("GET", "/api/x", undefined, "token", stop.signal);
    await vi.advanceTimersByTimeAsync(3500);
    stop.abort();
    await vi.runAllTimersAsync();

    expect(await answer).toBeUndefined();
    expect(calls).toHaveLength(3);
  });
});

describe("loading what the screen shows", () => {
  test("while the server is away the last good copy is shown (and it's known to be out of date), then the fresh one", async () => {
    serverBackAfter(0, { children: ["Nova"] });
    await keepLoading("/api/observatory/children", "token", new AbortController().signal, () => {});
    serverBackAfter(2, { children: ["Nova", "Pip"] });
    const shown: unknown[] = [];

    const loading = keepLoading("/api/observatory/children", "token", new AbortController().signal, (data) => shown.push(data));
    await vi.advanceTimersByTimeAsync(10);
    const meanwhile = { shown: [...shown], reachable: isReachable() };
    await vi.runAllTimersAsync();

    expect(meanwhile).toEqual({ shown: [{ children: ["Nova"] }], reachable: false });
    expect(await loading).toBe(200);
    expect(shown).toEqual([{ children: ["Nova"] }, { children: ["Nova", "Pip"] }]);
    expect(isReachable()).toBe(true);
  });

  test("a screen started with the server away and nothing remembered shows nothing until it answers", async () => {
    serverBackAfter(4, { children: ["Nova"] });
    const shown: unknown[] = [];

    const loading = keepLoading("/api/observatory/children", "token", new AbortController().signal, (data) => shown.push(data));
    await vi.runAllTimersAsync();

    expect(await loading).toBe(200);
    expect(shown).toEqual([{ children: ["Nova"] }]);
  });

  test("a proxy saying the server is down (a release starting) counts as away, and is asked again", async () => {
    let call = 0;
    vi.stubGlobal("fetch", async () =>
      ++call === 1 ? new Response("<html>Bad Gateway</html>", { status: 502 }) : new Response(JSON.stringify({ ok: 1 }), { status: 200 }),
    );

    const loading = keepLoading("/api/x", "token", new AbortController().signal, () => {});
    await vi.runAllTimersAsync();

    expect(await loading).toBe(200);
    expect(call).toBe(2);
  });
});
