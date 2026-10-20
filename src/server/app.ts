import Fastify from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
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

const webRoot = fileURLToPath(new URL("../../dist/web", import.meta.url));

export interface AppConfig {
  /** When false, nobody can create a new chart (keeps a home server closed to strangers). */
  allowNewCharts: boolean;
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
  const people = createPeople(db, clock);
  await peopleRoutes(app, people, config);
  const children = createChildren(db, clock);
  await childrenRoutes(app, people, children);
  await observatoryRoutes(app, people, children, createObservatories(db, clock));
  // The built web front ends (`vite build`), if present. Tests drive the API directly and don't need them.
  if (existsSync(webRoot)) await app.register(fastifyStatic, { root: webRoot });
  return app;
}
