# 07: Chore Frequency and the Chart's time zone

**What to build:** Each chore has a **Frequency**, defaulting to once per day. Once a chore is approved, it's unavailable to that child until the next period starts at midnight in the Chart's time zone. The Observatory shows it as done for today.

**Blocked by:** 05 (Hand in and approve)

**Status:** done

- [x] Chores have a Frequency, set by grown-ups, defaulting to once per day.
- [x] A chore approved in the current period can't be printed again by that child, and appears as done.
- [x] Periods start at midnight in the Chart's time zone. Tests move the fake Clock across midnight for Charts in different time zones.
- [x] An unfinished open chore ticket carries over: scanning it the next day still hands it in (ADR 0001).

## Notes

- A frequency is "N times per day" or "N times per week" (N from 1 to 10); weeks start on Monday. Chosen over a plain "once a day" because chores like brushing teeth happen twice a day. The glossary's Frequency entry says so.
- A chore counts against its frequency when it's **approved**, whenever it was printed. So yesterday's unfinished ticket, handed in and approved today, counts for today.
- Day and week boundaries use `Temporal` (built into Node 26) in the chart's own time zone, so daylight saving is handled. TypeScript needs `ESNext.Temporal` in `lib`.
- The Task Kind interface now receives a choosing context (now and the chart's time zone), and `issue` can answer "done" for a chore that can't be printed again yet.
- Two older tests were updated for the new behaviour: the menu now includes `done`, and the stable-code test moves to the next day before printing the same chore again.
