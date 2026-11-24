# 01: Star History rename

**What to build:** A child's record of stars earned and spent is called the **Star History** everywhere: in the API, the code and the Control Center. That frees **Constellation** to mean the star patterns a child's stars fill (see `CONTEXT.md`). Nothing a grown-up sees changes, except for wording.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Grown-ups read a child's Star History at `/api/children/:childId/star-history`, and observatories at `/api/observatory/children/:childId/star-history`, with the same shape and rules as before: totals, newest first, 404 for a child that isn't found or isn't yours.
- [ ] The old `/constellation` paths are gone (404). Only our own front ends used them, so they're renamed in one step.
- [ ] Tests, code and the Control Center say "star history" where they meant the record. The existing redemption and history tests pass under their new names.
- [ ] The current plain observatory's "My stars" view still works against the new path.
