# 15: Guest PINs

**What to build:** Any grown-up creates a **Guest PIN**, which expires after 12 hours by default or a chosen time, and can be cancelled early. A **Guest** enters it on the Observatory and gets a limited Control Center: approve, reject and dismiss tickets, and nothing else for now. Everything a guest does is recorded as done "by a guest".

**Blocked by:** 06 (Rejection, Dismissal and every scan result), 12 (Control Center on the Observatory)

**Status:** ready-for-agent

- [ ] Any grown-up can create a Guest PIN with a default 12-hour expiry or a chosen one, and cancel it.
- [ ] A valid Guest PIN on the Observatory opens a guest Control Center. Expired or cancelled PINs are refused (tested with the fake Clock).
- [ ] Guests can approve, reject and dismiss tickets, and are refused everything else: setup, Redemptions, people, pairing.
- [ ] Guest actions are recorded and shown as "by a guest".
- [ ] When ticket 16 lands, guests can also handle Reprint Requests (that ticket covers it).
