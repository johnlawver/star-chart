# 13: Invitations, roles and password reset

**What to build:** Email goes through an email outbox port, caught locally in development. Owners and Admins send **Invitations**, and accepting one creates the person's login in that Chart. The Owner promotes and demotes **Admins**. Pairing Observatories is limited to Admins and the Owner. Grown-ups can reset a forgotten password by email.

**Blocked by:** 03 (Pair an Observatory and fake parts)

**Status:** ready-for-agent

- [ ] All email goes through the email outbox port. In development, emails are caught locally, and tests read the outbox.
- [ ] Owners and Admins can invite by email. Accepting creates a grown-up login in that Chart (a person belongs to exactly one Chart).
- [ ] Only the Owner can promote a grown-up to Admin or demote an Admin.
- [ ] Only Admins and the Owner can pair or unpair Observatories. A plain grown-up on an unpaired Observatory sees "ask an admin to set this up".
- [ ] Password reset by email works, and reset links are single-use and expire.
- [ ] Permission tests cover every role for each of these actions.
