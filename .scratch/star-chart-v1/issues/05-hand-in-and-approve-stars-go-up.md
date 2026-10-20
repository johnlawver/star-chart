# 05: Hand in and approve: stars go up

**What to build:** The first complete loop. The child types the ticket's code into the fake Scanner, which is a **Hand-in**. The Observatory screen shows "handed in, waiting for a grown-up!" and the ticket becomes **Handed In**. A grown-up sees it in the Control Center and **Approves** it, optionally overriding the star value. The stars are recorded in the child's star record, and the **Balance** shown on the Observatory goes up.

**Blocked by:** 04 (Print a chore ticket)

**Status:** ready-for-agent

- [ ] A code sent by a Scanner moves the child's Open chore ticket to Handed In, and the Observatory that scanner belongs to shows the "waiting for a grown-up" feedback.
- [ ] The Control Center lists Handed In tickets.
- [ ] Approving a ticket marks it Approved (final) and adds its star value to the child's star record. A grown-up can override the star value when approving.
- [ ] The Balance is always computed from the star record, never stored separately, and appears on the child's Observatory view.
- [ ] A code from another Chart is "not recognised" (API test).
