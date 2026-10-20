import type { AppConfig } from "./app.js";

export interface ServerConfig {
  databaseUrl: string;
  smtpUrl: string;
  emailFrom: string;
  host: string;
  port: number;
  app: AppConfig;
}

/** Reads settings from the environment, which Doppler fills in (`doppler run`). Fails fast if anything required is missing. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const required = (name: string): string => {
    const value = env[name];
    if (!value) throw new Error(`${name} is not set. Add it to Doppler and run the server with \`doppler run -- …\`.`);
    return value;
  };
  return {
    databaseUrl: required("DATABASE_URL"),
    smtpUrl: required("SMTP_URL"),
    emailFrom: required("EMAIL_FROM"),
    // Listen on the loopback address only; Tailscale (`tailscale serve`) provides HTTPS in front of it.
    host: env.HOST ?? "127.0.0.1",
    port: Number(env.PORT ?? 4310),
    app: {
      allowNewCharts: env.ALLOW_NEW_CHARTS === "true",
      appUrl: required("APP_URL").replace(/\/$/, ""),
    },
  };
}
