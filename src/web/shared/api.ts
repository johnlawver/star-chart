/** Calls the Star Chart API, optionally as a paired device. */
export async function api(method: string, url: string, body?: unknown, deviceToken?: string) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (deviceToken) headers.authorization = `Bearer ${deviceToken}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  return { ok: response.ok, status: response.status, data };
}

/** Reads and writes a value in this browser's storage, coping with storage being unavailable. */
export const stored = {
  get(key: string): string | undefined {
    try {
      return localStorage.getItem(key) ?? undefined;
    } catch {
      return undefined;
    }
  },
  set(key: string, value: string | undefined): void {
    try {
      if (value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // Storage unavailable: the device will simply need pairing again next time.
    }
  },
};
