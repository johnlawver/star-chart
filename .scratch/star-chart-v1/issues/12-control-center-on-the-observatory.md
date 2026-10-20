# 12: Control Center on the Observatory

**What to build:** Each grown-up sets a personal **Grown-up PIN**. On the Observatory, entering it opens the Control Center. The screen returns to the children's view after a short idle time. From there, a grown-up can show a single-use, short-lived QR code that opens and installs the Control Center PWA on their phone and signs *that* grown-up in.

**Blocked by:** 05 (Hand in and approve)

**Status:** ready-for-agent

- [ ] Each grown-up can set and change their Grown-up PIN.
- [ ] Entering a valid Grown-up PIN on the Observatory opens the Control Center as that grown-up. A wrong PIN is refused, and repeated failures are rate-limited.
- [ ] After a short idle period, the Observatory returns to the children's view.
- [ ] The phone-setup QR code is only shown after PIN unlock. It signs in that grown-up only, works once and expires within minutes.
- [ ] The Control Center can be installed as a PWA on a phone.
