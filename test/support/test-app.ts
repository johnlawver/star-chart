import { afterAll } from "vitest";
import { buildApp, type AppConfig } from "../../src/server/app.js";
import { createTestDatabase } from "./database.js";
import { FakeClock } from "./fake-clock.js";
import { FakeMailer } from "./fake-mailer.js";
import { LiveConnection } from "./live-connection.js";
import WebSocket from "ws";

type Body = Record<string, unknown>;

export interface ApiResponse {
  status: number;
  body: any;
}

/**
 * A client that talks to the server only through its public HTTP API, keeping its own cookies,
 * the way a browser or a device would.
 */
export class ApiClient {
  private cookies = new Map<string, string>();
  private deviceToken: string | undefined;

  constructor(private readonly app: Awaited<ReturnType<typeof buildApp>>) {}

  async request(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: Body): Promise<ApiResponse> {
    const response = await this.app.inject({
      method,
      url,
      ...(payload === undefined ? {} : { payload }),
      headers: { ...this.cookieHeader(), ...this.deviceHeader() },
    });
    for (const cookie of response.cookies) {
      if (cookie.value === "" || (cookie.maxAge !== undefined && cookie.maxAge <= 0)) this.cookies.delete(cookie.name);
      else this.cookies.set(cookie.name, cookie.value);
    }
    const isJson = String(response.headers["content-type"] ?? "").includes("json");
    return { status: response.statusCode, body: response.body === "" || !isJson ? undefined : response.json() };
  }

  get = (url: string) => this.request("GET", url);

  /** Fetches a non-JSON resource, such as an SVG, and returns its body as text. */
  async getText(url: string): Promise<string> {
    const response = await this.app.inject({ method: "GET", url, headers: this.cookieHeader() });
    return response.body;
  }
  post = (url: string, payload?: Body) => this.request("POST", url, payload);
  put = (url: string, payload?: Body) => this.request("PUT", url, payload);
  patch = (url: string, payload?: Body) => this.request("PATCH", url, payload);
  delete = (url: string) => this.request("DELETE", url);

  /** From now on, act as a paired device: send its credential the way a device would. */
  useDeviceToken(token: string): void {
    this.deviceToken = token;
  }

  private deviceHeader(): Record<string, string> {
    return this.deviceToken ? { authorization: `Bearer ${this.deviceToken}` } : {};
  }

  private cookieHeader(): Record<string, string> {
    if (this.cookies.size === 0) return {};
    return { cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ") };
  }
}

const defaultConfig: AppConfig = { allowNewCharts: true, appUrl: "https://star-chart.test" };

/** Starts the real server in-process against the test database, with a controllable clock. */
export async function startTestApp(config: Partial<AppConfig> = {}) {
  const db = createTestDatabase();
  const clock = new FakeClock(new Date("2026-10-20T08:00:00Z"));
  const mailer = new FakeMailer();
  const app = await buildApp({ db, clock, mailer, config: { ...defaultConfig, ...config } });
  // HTTP requests are injected in-process, but live connections are real network connections (ADR 0003),
  // so connecting, closing and dropping behave exactly as they do for real devices.
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  if (!address || typeof address === "string") throw new Error("test server has no port");
  const liveUrl = `ws://127.0.0.1:${address.port}/api/parts/live`;
  afterAll(async () => {
    await app.close();
    await db.destroy();
  });
  return {
    clock,
    mailer,
    newClient: () => new ApiClient(app),
    /** Opens a device's live connection to the server, the way a screen, printer or scanner would. */
    openLiveConnection: async () => {
      const socket = new WebSocket(liveUrl);
      await new Promise((resolve, reject) => {
        socket.once("open", resolve);
        socket.once("error", reject);
      });
      return new LiveConnection(socket);
    },
  };
}

let uniqueCounter = 0;
/** An email address no other test uses, so tests never collide in the shared database. */
export function uniqueEmail(name = "grown-up"): string {
  uniqueCounter += 1;
  return `${name}-${Date.now()}-${uniqueCounter}@example.test`;
}
