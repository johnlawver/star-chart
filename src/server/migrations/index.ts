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
import * as redemptions from "./0014-redemptions.js";
import * as starMovementOrder from "./0015-star-movement-order.js";
import * as grownUpPins from "./0016-grown-up-pins.js";
import * as pinLockout from "./0017-pin-lockout.js";
import * as phoneSetupCodes from "./0018-phone-setup-codes.js";
import * as invitations from "./0019-invitations.js";
import * as passwordResets from "./0020-password-resets.js";
import * as reprintRequests from "./0021-reprint-requests.js";
import * as pushNotifications from "./0022-push-notifications.js";
import * as dailySummary from "./0023-daily-summary.js";
import * as guestPins from "./0024-guest-pins.js";
import * as quizzes from "./0025-quizzes.js";
import * as quizOrder from "./0026-quiz-order.js";
import * as feedKeys from "./0027-feed-keys.js";
import * as tasksStandAlone from "./0028-tasks-stand-alone.js";

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
  "0014-redemptions": redemptions,
  "0015-star-movement-order": starMovementOrder,
  "0016-grown-up-pins": grownUpPins,
  "0017-pin-lockout": pinLockout,
  "0018-phone-setup-codes": phoneSetupCodes,
  "0019-invitations": invitations,
  "0020-password-resets": passwordResets,
  "0021-reprint-requests": reprintRequests,
  "0022-push-notifications": pushNotifications,
  "0023-daily-summary": dailySummary,
  "0024-guest-pins": guestPins,
  "0025-quizzes": quizzes,
  "0026-quiz-order": quizOrder,
  "0027-feed-keys": feedKeys,
  "0028-tasks-stand-alone": tasksStandAlone,
};
