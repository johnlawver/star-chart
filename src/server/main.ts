import { buildApp } from "./app.js";
import { systemClock } from "./clock.js";
import { loadConfig } from "./config.js";
import { createDatabase, migrateToLatest } from "./database.js";
import { smtpMailer } from "./email.js";
import { webPushSender } from "./push.js";

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
await migrateToLatest(db);

const mailer = smtpMailer(config.smtpUrl, config.emailFrom);
const push = webPushSender(config.vapid);
const app = await buildApp({ db, clock: systemClock, mailer, push, config: config.app });
await app.listen({ host: config.host, port: config.port });
console.log(`Star Chart is listening on http://${config.host}:${config.port}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await app.close();
    await db.destroy();
    process.exit(0);
  });
}
