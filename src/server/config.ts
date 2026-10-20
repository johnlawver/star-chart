import type { AppConfig } from "./app.js";

export interface ServerConfig {
  databaseUrl: string;
  host: string;
  port: number;
  app: AppConfig;
}

/** Reads settings from the environment, which Doppler fills in (`doppler run`). Fails fast if anything required is missing. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set. Run the server with `doppler run -- …`.");
  return {
    databaseUrl,
    // Listen on the loopback address only; Tailscale (`tailscale serve`) provides HTTPS in front of it.
    host: env.HOST ?? "127.0.0.1",
    port: Number(env.PORT ?? 4310),
    app: {
      allowNewCharts: env.ALLOW_NEW_CHARTS === "true",
    },
  };
}
