import Fastify from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Clock } from "./clock.js";
import type { Database } from "./database.js";
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

const webRoot = fileURLToPath(new URL("../../dist/web", import.meta.url));

export interface AppConfig {
  /** When false, nobody can create a new chart (keeps a home server closed to strangers). */
  allowNewCharts: boolean;
  /** How often connected devices are checked for signs of life. Defaults to 15 seconds. */
  heartbeatMs?: number;
}

export interface AppDependencies {
  db: Database;
  clock: Clock;
  config: AppConfig;
}

export async function buildApp({ db, clock, config }: AppDependencies) {
  // Unexpected fields in a request are refused, not silently dropped (we never store more than we asked for).
  const app = Fastify({ ajv: { customOptions: { removeAdditional: false } } });
  await app.register(cookie);
  await app.register(websocket);
  const people = createPeople(db, clock);
  await peopleRoutes(app, people, config);
  const children = createChildren(db, clock);
  await childrenRoutes(app, people, children);
  const observatories = createObservatories(db, clock);
  const liveParts = new LiveParts(config.heartbeatMs ?? 15_000);
  app.addHook("onClose", async () => liveParts.stop());
  await observatoryRoutes(app, people, children, observatories, liveParts);
  await catalogRoutes(app, people, observatories, createCatalog(db, clock));
  const stars = createStars(db, clock);
  await ticketRoutes(app, people, observatories, liveParts, createTickets(db, clock, stars));
  await starRoutes(app, observatories, children, stars);
  // The built web front ends (`vite build`), if present. Tests drive the API directly and don't need them.
  if (existsSync(webRoot)) await app.register(fastifyStatic, { root: webRoot });
  return app;
}
