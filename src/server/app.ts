import Fastify from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Clock } from "./clock.js";
import type { Database } from "./database.js";
import type { Mailer } from "./email.js";
import type { PushSender } from "./push.js";
import { createNotifications } from "./notifications/notifications.js";
import { notificationRoutes } from "./notifications/routes.js";
import { createDailySummary } from "./notifications/daily-summary.js";
import { createPeople } from "./people/people.js";
import { peopleRoutes } from "./people/routes.js";
import { createChildren } from "./people/children.js";
import { childrenRoutes } from "./people/children-routes.js";
import { createObservatories } from "./observatories/observatories.js";
import { observatoryRoutes } from "./observatories/routes.js";
import { LiveParts } from "./observatories/live-parts.js";
import { createCatalog } from "./catalog/catalog.js";
import { catalogRoutes } from "./catalog/routes.js";
import { createTickets } from "./tickets/tickets.js";
import { ticketRoutes } from "./tickets/routes.js";
import { createStars } from "./stars/stars.js";
import { starRoutes } from "./stars/routes.js";
import { iconRoutes } from "./icons/routes.js";
import { createQuizPools } from "./quizzes/quiz-pools.js";
import { quizRoutes } from "./quizzes/routes.js";
import { createQuizFeed } from "./quizzes/feed.js";
import { feedRoutes } from "./quizzes/feed-routes.js";
import { createReprints } from "./tickets/reprints.js";
import { reprintRoutes } from "./tickets/reprint-routes.js";

const webRoot = fileURLToPath(new URL("../../dist/web", import.meta.url));

export interface AppConfig {
  /** When false, nobody can create a new chart (keeps a home server closed to strangers). */
  allowNewCharts: boolean;
  /** How often connected devices are checked for signs of life. Defaults to 15 seconds. */
  heartbeatMs?: number;
  /** The address people use to reach Star Chart, for links in emails, such as https://mini.example.ts.net */
  appUrl: string;
  /** The public half of our VAPID key pair, which browsers need to subscribe to push notifications. */
  vapidPublicKey: string;
  /** How long after one hand-in notification others are held back and grouped. Defaults to a minute. */
  handInGroupingMs?: number;
  /** How often scheduled jobs run. Defaults to 30 seconds; null means only when asked (tests). */
  scheduledJobsEveryMs?: number | null;
}

declare module "fastify" {
  interface FastifyInstance {
    /** Runs every scheduled job once, now. */
    runScheduledJobs(): Promise<void>;
  }
}

export interface AppDependencies {
  db: Database;
  clock: Clock;
  mailer: Mailer;
  push: PushSender;
  config: AppConfig;
}

export async function buildApp({ db, clock, mailer, push, config }: AppDependencies) {
  // Unexpected fields in a request are refused, not silently dropped (we never store more than we asked for).
  const app = Fastify({ ajv: { customOptions: { removeAdditional: false } } });
  await app.register(cookie);
  await app.register(websocket);
  const people = createPeople(db, clock);
  await peopleRoutes(app, people, config, mailer);
  const children = createChildren(db, clock);
  await childrenRoutes(app, people, children);
  const observatories = createObservatories(db, clock);
  const notifications = createNotifications(db, clock, push, {
    appUrl: config.appUrl,
    handInGroupingMs: config.handInGroupingMs ?? 60_000,
  });
  await notificationRoutes(app, people, notifications, config.vapidPublicKey);

  // Jobs that run on their own, every so often: whatever is due, they do.
  const scheduledJobs: (() => Promise<void>)[] = [];
  app.decorate("runScheduledJobs", async () => {
    for (const job of scheduledJobs) {
      try {
        await job();
      } catch (error) {
        app.log.error({ error }, "a scheduled job failed");
      }
    }
  });
  scheduledJobs.push(() => notifications.sendHeldBackHandIns());
  const dailySummary = createDailySummary(db, clock, notifications, config.appUrl);
  scheduledJobs.push(() => dailySummary.sendDue());
  const jobsEveryMs = config.scheduledJobsEveryMs === undefined ? 30_000 : config.scheduledJobsEveryMs;
  if (jobsEveryMs !== null) {
    const timer = setInterval(() => void app.runScheduledJobs(), jobsEveryMs);
    timer.unref();
    app.addHook("onClose", async () => clearInterval(timer));
  }

  const liveParts = new LiveParts(config.heartbeatMs ?? 15_000);
  app.addHook("onClose", async () => await liveParts.stop());
  await observatoryRoutes(app, people, children, observatories, liveParts);
  await catalogRoutes(app, people, observatories, createCatalog(db, clock));
  const stars = createStars(db, clock);
  await ticketRoutes(app, people, observatories, liveParts, createTickets(db, clock, stars), notifications);
  await starRoutes(app, people, observatories, children, stars);
  await iconRoutes(app);
  await quizRoutes(app, people, createQuizPools(db, clock));
  await feedRoutes(app, people, createQuizFeed(db, clock));
  await reprintRoutes(app, people, observatories, liveParts, createReprints(db, clock), notifications);
  // The built web front ends (`vite build`), if present. Tests drive the API directly and don't need them.
  if (existsSync(webRoot)) await app.register(fastifyStatic, { root: webRoot });
  return app;
}
