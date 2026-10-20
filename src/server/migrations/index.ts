import type { Migration } from "kysely/migration";
import * as chartsAndGrownUps from "./0001-charts-and-grown-ups.js";

// Every schema change is a migration, listed here in order. Never edit one that has shipped; add a new one.
export const migrations: Record<string, Migration> = {
  "0001-charts-and-grown-ups": chartsAndGrownUps,
};
