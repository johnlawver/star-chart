# 14: Ownership transfer, removal and deletion

**What to build:** The Owner transfers ownership to an Admin, and can't leave the Chart without doing so. Owners and Admins remove grown-ups, but only the Owner removes Admins. A removed grown-up's past actions show as "a former grown-up". Deleting a child permanently deletes their tickets, star record and pools. The Owner can delete the whole Chart, which permanently deletes everything in it. The deletion rules are the spec's proposed default (see Further Notes in the spec).

**Blocked by:** 13 (Invitations, roles and password reset), 10 (Quizzes), 11 (Redemptions and Constellation)

**Status:** ready-for-agent

- [ ] The Owner can transfer ownership to an Admin, and the previous Owner becomes an Admin.
- [ ] The Owner can't leave without transferring first.
- [ ] Owners and Admins can remove grown-ups. Only the Owner can remove an Admin. Their login is deleted, and their past actions are attributed to "a former grown-up".
- [ ] Deleting a child permanently removes their tickets, star record and Quiz Pools. Nothing is just hidden.
- [ ] Only the Owner can delete the Chart, which permanently removes all its data, including grown-ups, children, Observatories and devices.
- [ ] Tests confirm that deleted data is gone and that other Charts are untouched.
