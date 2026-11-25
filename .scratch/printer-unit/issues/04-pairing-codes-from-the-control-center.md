# 04: Make a pairing code from the Control Center

**What to build:** A signed-in owner or admin can make a pairing code from the Control Center for an observatory they choose, for example on their phone. Today codes can only be made on an unlocked observatory screen. The phone setup page (ticket 05) needs this, and it's handy on its own for pairing the fake parts from a laptop.

**Blocked by:** None

**Status:** done (2026-11-24)

- [x] `POST /api/observatories/:observatoryId/pairing-codes`, for a signed-in owner or admin of that observatory's chart, returns `{code, expiresAt}` (201). It uses the same codes as today: one use, 10 minutes.
- [x] Other grown-ups get 403. An observatory in another chart, or one that doesn't exist, is 404.
- [x] Making codes has a rate limit suited to the open internet.
- [x] In the Control Center's observatory settings, "Pair a printer or scanner" shows the code and when it expires, for each observatory.
- [x] The existing way, from an unlocked observatory screen, keeps working.

## Comments

2026-11-24: Done. `POST /api/observatories/:observatoryId/pairing-codes` (owner or admin; 403 for others; 404 for an observatory in another chart or none; 401 signed out) returns `{code, expiresAt}`, the same codes as before. Making codes, either way, is limited to 20 an hour per grown-up (`pairingCodesPerGrownUp`). Claiming a code was already limited per address (wrong codes). Each observatory in Settings has "Pair a printer or scanner", which shows the code and the time it stops working. Tests: `test/pairing-codes-from-control-center.test.ts`, plus a phone-sized smoke test that pairs a unit with the code shown.
