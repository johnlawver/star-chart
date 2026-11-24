# 04: Make a pairing code from the Control Center

**What to build:** A signed-in owner or admin can make a pairing code from the Control Center for an observatory they choose, for example on their phone. Today codes can only be made on an unlocked observatory screen. The phone setup page (ticket 05) needs this, and it's handy on its own for pairing the fake parts from a laptop.

**Blocked by:** None

**Status:** ready-for-agent

- [ ] `POST /api/observatories/:observatoryId/pairing-codes`, for a signed-in owner or admin of that observatory's chart, returns `{code, expiresAt}` (201). It uses the same codes as today: one use, 10 minutes.
- [ ] Other grown-ups get 403. An observatory in another chart, or one that doesn't exist, is 404.
- [ ] Making codes has a rate limit suited to the open internet.
- [ ] In the Control Center's observatory settings, "Pair a printer or scanner" shows the code and when it expires, for each observatory.
- [ ] The existing way, from an unlocked observatory screen, keeps working.
