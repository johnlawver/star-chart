# 10: The observatory looks after itself

**What to build:** The frame runs for weeks with no keyboard and no reload button. Its Wi-Fi comes up after the kiosk has already loaded the page, and the server may restart. The observatory recovers from all of that by itself, so a child never finds a broken screen.

**Blocked by:** 04 (The Dome)

**Status:** done (2026-11-24), except the last check, which needs the real frame (ready-for-human)

- [x] Every observatory request retries with backoff (starting at about 1 s, up to about 30 s). One failed request never leaves a permanent error.
- [x] While the server can't be reached, the screen keeps showing the last good data. A small, unobtrusive sign shows it's out of date. Printing is refused with a friendly "the observatory is waking up" until the server is back.
- [x] The live connection reconnects with backoff instead of a fixed 3 s.
- [x] The page reloads itself once a night at 3am in the chart's time zone, only while nobody is mid-task.
- [x] Loading the page before the network is up recovers without a reload: the smoke test starts the page with the API unreachable, then brings it back.
- [ ] The device credential survives a reboot of the frame (localStorage in the kiosk's WebView). Checked on the real frame and noted in the ticket.

## Comments

2026-11-24: Done, apart from checking the credential on the real frame.

- `src/web/observatory/connection.ts`: `ask` never throws (status 0 means the server couldn't be reached; 502, 503 and 504 from the proxy count the same). `keepAsking` and `keepLoading` retry after 1, 2, 4… up to 30 s (`src/web/shared/backoff.ts`). `keepLoading` keeps the last good copy of each address in localStorage and shows it at once while the server is away, even straight after a reload. The copies are forgotten when the screen is unpaired.
- While the server is away, a small "Waking up…" sign shows in the top corner. Printing (and asking for a reprint) is refused with "The observatory is waking up. Try again in a minute!" and is never retried by itself. A child's stale totals never fly new stars, and the visit is only recorded from a fresh answer. The visit itself is retried.
- The live connection reconnects with the same backoff, reset on each welcome. This applies to the fake parts too.
- `GET /api/observatory/schedule` returns `{ now, nightlyReload }`: the next 3am in the chart's time zone, following daylight saving. The screen measures the wait on `performance.now()`, so a wrong or changing frame clock doesn't matter. It reloads only on Who are you with no scan message showing, only while the server is reachable, and only after fetching the page itself successfully, so it never lands on a browser error page.
- Smoke tests: starting with the API unreachable, then bringing it back; losing the server mid-task (no print, reload still shows Nova, comes back by itself); the nightly reload with the page clock moved on a day. All three fail against the previous page.
- Still to check on the frame: the device credential (localStorage) survives the frame being switched off and on.
