# 03: One unit is both an observatory's printer and its scanner

**What to build:** A **Unit** pairs once and does both jobs. The server prints to it and accepts hand-ins from it as if it were a printer and a scanner, using one credential and one live connection. Separate printers and scanners, like the fake ones, keep working as they do today.

**Blocked by:** None

**Status:** done (2026-11-24)

**Proposal (refine during TDD):** pairing takes `kinds` instead of a single `kind`, as `POST /api/parts {code, kinds: ["printer", "scanner"]}`. The old `{code, kind}` stays accepted. The stored part records each job it does. The places that look for "the observatory's printer" or check that a scan came from a scanner then ask "does this part print?" or "does this part scan?".

- [x] Pairing with both kinds returns one device token, and the observatory's parts list shows one part that prints and scans.
- [x] A child printing a task sends the print job to the unit. A `scan` message from the unit hands the ticket in, and the `scan-result` goes back to it.
- [x] The Control Center's parts status shows the printer and the scanner as online while the unit is connected, and both as offline when it drops.
- [x] Unpairing the unit removes both jobs.
- [x] Separate printers and scanners pair and behave exactly as before, and the existing tests pass unchanged.
- [x] `CONTEXT.md` defines **Unit** (done with the spec; check it still fits).

## Comments

2026-11-24: Done, with one change from the proposal: a unit is a part of kind `unit`, paired as `POST /api/parts {code, kind: "unit"}`, not a list of kinds. It's one row with one credential, and `prints(kind)` / `scans(kind)` in `database.ts` answer "does this part print / scan?". Migration 0034 widens the `devices.kind` check. Print jobs go to a printer or unit (`LiveParts.sendToPrinter`); scans are accepted from a scanner or unit, and the `scan-result` goes to the screen and every part that scans. `GET /api/observatory/parts` counts a unit as both the printer and the scanner. The Control Center lists it as "printer + scanner". Tests: `test/units.test.ts`; existing tests pass unchanged. Ticket 08 (firmware) should pair with `kind: "unit"`.
