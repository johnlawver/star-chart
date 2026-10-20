import Fastify from "fastify";
import cookie from "@fastify/cookie";
import type { Clock } from "./clock.js";
import type { Database } from "./database.js";
import { createPeople } from "./people/people.js";
import { peopleRoutes } from "./people/routes.js";

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
  const app = Fastify();
  await app.register(cookie);
  await peopleRoutes(app, createPeople(db, clock), config);
  return app;
}
