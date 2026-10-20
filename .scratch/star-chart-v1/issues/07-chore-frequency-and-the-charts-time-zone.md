# 07: Chore Frequency and the Chart's time zone

**What to build:** Each chore has a **Frequency**, defaulting to once per day. Once a chore is approved, it's unavailable to that child until the next period starts at midnight in the Chart's time zone. The Observatory shows it as done for today.

**Blocked by:** 05 (Hand in and approve)

**Status:** ready-for-agent

- [ ] Chores have a Frequency, set by grown-ups, defaulting to once per day.
- [ ] A chore approved in the current period can't be printed again by that child, and appears as done.
- [ ] Periods start at midnight in the Chart's time zone. Tests move the fake Clock across midnight for Charts in different time zones.
- [ ] An unfinished open chore ticket carries over: scanning it the next day still hands it in (ADR 0001).
