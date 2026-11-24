# 03: One unit is both an observatory's printer and its scanner

**What to build:** A **Unit** pairs once and does both jobs. The server prints to it and accepts hand-ins from it as if it were a printer and a scanner, using one credential and one live connection. Separate printers and scanners, like the fake ones, keep working as they do today.

**Blocked by:** None

**Status:** ready-for-agent

**Proposal (refine during TDD):** pairing takes `kinds` instead of a single `kind`, as `POST /api/parts {code, kinds: ["printer", "scanner"]}`. The old `{code, kind}` stays accepted. The stored part records each job it does. The places that look for "the observatory's printer" or check that a scan came from a scanner then ask "does this part print?" or "does this part scan?".

- [ ] Pairing with both kinds returns one device token, and the observatory's parts list shows one part that prints and scans.
- [ ] A child printing a task sends the print job to the unit. A `scan` message from the unit hands the ticket in, and the `scan-result` goes back to it.
- [ ] The Control Center's parts status shows the printer and the scanner as online while the unit is connected, and both as offline when it drops.
- [ ] Unpairing the unit removes both jobs.
- [ ] Separate printers and scanners pair and behave exactly as before, and the existing tests pass unchanged.
- [ ] `CONTEXT.md` defines **Unit** (done with the spec; check it still fits).
