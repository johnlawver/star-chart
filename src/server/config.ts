import type { AppConfig } from "./app.js";

export interface ServerConfig {
  databaseUrl: string;
  vapid: { publicKey: string; privateKey: string; subject: string };
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
    vapid: {
      publicKey: required("VAPID_PUBLIC_KEY"),
      privateKey: required("VAPID_PRIVATE_KEY"),
      subject: required("VAPID_SUBJECT"),
    },
    smtpUrl: required("SMTP_URL"),
    emailFrom: required("EMAIL_FROM"),
    // Locally, listen on the loopback address only (Tailscale provides HTTPS in front of it). The Dockerfile sets 0.0.0.0
    // for the host's proxy.
    host: env.HOST ?? "127.0.0.1",
    port: Number(env.PORT ?? 4310),
    app: {
      allowNewCharts: env.ALLOW_NEW_CHARTS === "true",
      appUrl: required("APP_URL").replace(/\/$/, ""),
      vapidPublicKey: required("VAPID_PUBLIC_KEY"),
      // Set in the Dockerfile: deployed, the host's proxy (Traefik) is the one hop in front.
      trustProxyHops: Number(env.TRUST_PROXY_HOPS ?? 0),
    },
  };
}
