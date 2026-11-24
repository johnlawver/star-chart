# 10: The observatory looks after itself

**What to build:** The frame runs for weeks with no keyboard and no reload button. Its Wi-Fi comes up after the kiosk has already loaded the page, and the server may restart. The observatory recovers from all of that by itself, so a child never finds a broken screen.

**Blocked by:** 04 (The Dome)

**Status:** ready-for-agent

- [ ] Every observatory request retries with backoff (starting at about 1 s, up to about 30 s). One failed request never leaves a permanent error.
- [ ] While the server can't be reached, the screen keeps showing the last good data. A small, unobtrusive sign shows it's out of date. Printing is refused with a friendly "the observatory is waking up" until the server is back.
- [ ] The live connection reconnects with backoff instead of a fixed 3 s.
- [ ] The page reloads itself once a night at 3am in the chart's time zone, only while nobody is mid-task.
- [ ] Loading the page before the network is up recovers without a reload: the smoke test starts the page with the API unreachable, then brings it back.
- [ ] The device credential survives a reboot of the frame (localStorage in the kiosk's WebView). Checked on the real frame and noted in the ticket.
