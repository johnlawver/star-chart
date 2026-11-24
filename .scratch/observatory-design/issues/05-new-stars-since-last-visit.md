# 05: New stars since last visit

**What to build:** When a child opens their screen, the stars approved since their last visit (**New Stars**) fly into their star jar one by one, with "You earned 3 stars!" for children who see words. They arrive once, on whichever observatory the child opens first.

**Blocked by:** 04 (The Dome)

**Status:** done (2026-11-24)

- [x] Each child has a last-visit time, stored with the child. A new child counts from when they were added.
- [x] The child's observatory view includes `newStars`: stars earned by approvals after the last visit. Spending doesn't reduce it (API tests use FakeClock and worked examples).
- [x] `POST /api/observatory/children/:childId/visit` (screen) records now as the last visit. After it, `newStars` is 0 until more stars are approved. Returns 404 for a child that isn't found or isn't yours.
- [x] A visit on one observatory clears new stars for the other observatories too (API test).
- [x] The Dome pours the new stars into the jar, then records the visit. With no new stars the screen is ready straight away, and a tap skips the animation (and still records the visit).
- [x] The smoke test sees new stars land after an approval.

## Comments

2026-11-24: Done. `children.last_visit_at` (migration 0030) and `newStars` come from the child's totals, plus `POST /api/observatory/children/:childId/visit`, which returns 204. The Dome shows the jar at the balance before the new stars, flies in up to 12 of them (with "You earned N stars!" for words), then records the visit. A tap skips ahead, and a backup timer carries on if the frame never reports the landing. The smoke test now uses the real clock, so a visit and a later approval have different times. The "arrives only once" check was confirmed by switching off the visit call.
