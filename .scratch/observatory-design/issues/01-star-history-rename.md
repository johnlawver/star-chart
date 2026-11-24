# 01: Star History rename

**What to build:** A child's record of stars earned and spent is called the **Star History** everywhere: in the API, the code and the Control Center. That frees **Constellation** to mean the star patterns a child's stars fill (see `CONTEXT.md`). Nothing a grown-up sees changes, except for wording.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Grown-ups read a child's Star History at `/api/children/:childId/star-history`, and observatories at `/api/observatory/children/:childId/star-history`, with the same shape and rules as before: totals, newest first, 404 for a child that isn't found or isn't yours.
- [x] The old `/constellation` paths are gone (404). Only our own front ends used them, so they're renamed in one step.
- [x] Tests, code and the Control Center say "star history" where they meant the record. The existing redemption and history tests pass under their new names.
- [x] The current plain observatory's "My stars" view still works against the new path.

## Notes

- The paths are now `/api/children/:childId/star-history` and `/api/observatory/children/:childId/star-history`, and the old `/constellation` paths return 404 (tested). The test file is now `redemptions-and-star-history.test.ts`.
- On the front end, `shared/constellation.tsx` is now `shared/star-history.tsx` (`StarHistoryList`). The Control Center button reads "Show star history".
- Migration 0015's comment still says "constellation". Shipped migrations aren't edited.
