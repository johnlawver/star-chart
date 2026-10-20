# 18: Daily Summary

**What to build:** Every evening at 7pm in each Chart's time zone, its grown-ups get a **Daily Summary** notification: each child's stars earned that day and their tickets still open.

**Blocked by:** 07 (Chore Frequency and the Chart's time zone), 17 (Push notifications)

**Status:** ready-for-agent

- [ ] At 7pm local time for each Chart, a Daily Summary goes out through the push outbox to its grown-ups.
- [ ] It shows, per child, the stars earned today (in the Chart's time zone) and the open tickets.
- [ ] Charts in different time zones get their summaries at their own 7pm, and each Chart gets exactly one per day (tested with the fake Clock).
