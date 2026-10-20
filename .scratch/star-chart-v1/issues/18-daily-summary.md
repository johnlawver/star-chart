# 18: Daily Summary

**What to build:** Every evening at 7pm in each Chart's time zone, its grown-ups get a **Daily Summary** notification: each child's stars earned that day and their tickets still open.

**Blocked by:** 07 (Chore Frequency and the Chart's time zone), 17 (Push notifications)

**Status:** done

- [x] At 7pm local time for each Chart, a Daily Summary goes out through the push outbox to its grown-ups.
- [x] It shows, per child, the stars earned today (in the Chart's time zone) and the open tickets.
- [x] Charts in different time zones get their summaries at their own 7pm, and each Chart gets exactly one per day (tested with the fake Clock).

## Notes

- Runs as a scheduled job (every 30 seconds in real use). Each chart records the local date whose summary was sent; a run claims today's with one atomic update before sending, so it goes out exactly once even if runs overlap.
- If the server was down at 7pm, the summary goes out when it's back that evening. After the chart's midnight the date has moved on, so a missed day is skipped rather than sent late.
- "Earned today" is star movements above zero since the chart's local midnight; spending isn't counted. "Open" means Open tickets (handed-in ones are already waiting on grown-ups, who get hand-in notifications).
- Charts with no children get no summary. Every run looks at every chart, which is fine for now; with many charts it should only look at charts whose 7pm has just passed.
