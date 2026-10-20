import type { Migration } from "kysely/migration";
import * as chartsAndGrownUps from "./0001-charts-and-grown-ups.js";
import * as children from "./0002-children.js";
import * as observatories from "./0003-observatories.js";
import * as pairingCodes from "./0004-pairing-codes.js";
import * as catalog from "./0005-catalog.js";

// Every schema change is a migration, listed here in order. Never edit one that has shipped; add a new one.
export const migrations: Record<string, Migration> = {
  "0001-charts-and-grown-ups": chartsAndGrownUps,
  "0002-children": children,
  "0003-observatories": observatories,
  "0004-pairing-codes": pairingCodes,
  "0005-catalog": catalog,
};
