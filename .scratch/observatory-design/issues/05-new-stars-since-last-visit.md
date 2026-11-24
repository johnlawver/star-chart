# 05: New stars since last visit

**What to build:** When a child opens their screen, the stars approved since their last visit (**New Stars**) fly into their star jar one by one, with "You earned 3 stars!" for children who see words. They arrive once, on whichever observatory the child opens first.

**Blocked by:** 04 (The Dome)

**Status:** ready-for-agent

- [ ] Each child has a last-visit time, stored with the child. A new child counts from when they were added.
- [ ] The child's observatory view includes `newStars`: stars earned by approvals after the last visit. Spending doesn't reduce it (API tests use FakeClock and worked examples).
- [ ] `POST /api/observatory/children/:childId/visit` (screen) records now as the last visit. After it, `newStars` is 0 until more stars are approved. Returns 404 for a child that isn't found or isn't yours.
- [ ] A visit on one observatory clears new stars for the other observatories too (API test).
- [ ] The Dome pours the new stars into the jar, then records the visit. With no new stars the screen is ready straight away, and a tap skips the animation (and still records the visit).
- [ ] The smoke test sees new stars land after an approval.
