# 14: Ownership transfer, removal and deletion

**What to build:** The Owner transfers ownership to an Admin, and can't leave the Chart without doing so. Owners and Admins remove grown-ups, but only the Owner removes Admins. A removed grown-up's past actions show as "a former grown-up". Deleting a child permanently deletes their tickets, star record and pools. The Owner can delete the whole Chart, which permanently deletes everything in it. The deletion rules are the spec's proposed default (see Further Notes in the spec).

**Blocked by:** 13 (Invitations, roles and password reset), 10 (Quizzes), 11 (Redemptions and Constellation)

**Status:** done

- [x] The Owner can transfer ownership to an Admin, and the previous Owner becomes an Admin.
- [x] The Owner can't leave without transferring first.
- [x] Owners and Admins can remove grown-ups. Only the Owner can remove an Admin. Their login is deleted, and their past actions are attributed to "a former grown-up".
- [x] Deleting a child permanently removes their tickets, star record and Quiz Pools. Nothing is just hidden.
- [x] Only the Owner can delete the Chart, which permanently removes all its data, including grown-ups, children, Observatories and devices.
- [x] Tests confirm that deleted data is gone and that other Charts are untouched.

## Notes

- Ownership goes only to an admin; the old owner becomes an admin. The owner can't leave (`DELETE /api/me`) until they've handed the chart over; anyone else can leave, which deletes their login.
- Who may remove whom is one table: the owner removes admins and grown-ups; admins remove grown-ups. Nobody removes the owner, and nobody removes themselves that way (they leave instead). Removing someone deletes their login, so they're signed out everywhere at once; what they did stays on record as "a former grown-up".
- Deleting a child or a chart is a real delete: the database cascades to everything that belongs to it. Deleting a chart (owner only, typing its name to confirm) also disconnects its devices straight away.
- Deletion tests check through the API *and* directly in the database: a helper finds every table with a `child_id` / `chart_id` / `ticket_id` column and asserts no rows remain, so tables added later (quiz pools) are covered automatically. This is the one deliberate exception to testing only through the API, because an API can show data is hidden but not that it's gone. A "soft delete" was tried as a check and the test caught it.
- The spec marked these deletion rules as a proposed default to confirm before Star Chart serves anyone outside our household, along with a proper look at COPPA and FERPA. That still stands.
