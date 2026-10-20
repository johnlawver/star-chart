import type { Migration } from "kysely/migration";
import * as chartsAndGrownUps from "./0001-charts-and-grown-ups.js";
import * as children from "./0002-children.js";
import * as observatories from "./0003-observatories.js";
import * as pairingCodes from "./0004-pairing-codes.js";
import * as catalog from "./0005-catalog.js";
import * as tickets from "./0006-tickets.js";
import * as stars from "./0007-stars.js";
import * as ticketNotes from "./0008-ticket-notes.js";
import * as oneOpenTicketPerCategory from "./0009-one-open-ticket-per-category.js";
import * as ticketHistory from "./0010-ticket-history.js";
import * as ticketHistoryOrder from "./0011-ticket-history-order.js";
import * as choreFrequency from "./0012-chore-frequency.js";
import * as icons from "./0013-icons.js";

// Every schema change is a migration, listed here in order. Never edit one that has shipped; add a new one.
export const migrations: Record<string, Migration> = {
  "0001-charts-and-grown-ups": chartsAndGrownUps,
  "0002-children": children,
  "0003-observatories": observatories,
  "0004-pairing-codes": pairingCodes,
  "0005-catalog": catalog,
  "0006-tickets": tickets,
  "0007-stars": stars,
  "0008-ticket-notes": ticketNotes,
  "0009-one-open-ticket-per-category": oneOpenTicketPerCategory,
  "0010-ticket-history": ticketHistory,
  "0011-ticket-history-order": ticketHistoryOrder,
  "0012-chore-frequency": choreFrequency,
  "0013-icons": icons,
};
