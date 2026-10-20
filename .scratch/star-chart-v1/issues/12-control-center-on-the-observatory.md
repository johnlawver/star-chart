# 12: Control Center on the Observatory

**What to build:** Each grown-up sets a personal **Grown-up PIN**. On the Observatory, entering it opens the Control Center. The screen returns to the children's view after a short idle time. From there, a grown-up can show a single-use, short-lived QR code that opens and installs the Control Center PWA on their phone and signs *that* grown-up in.

**Blocked by:** 05 (Hand in and approve)

**Status:** done

- [x] Each grown-up can set and change their Grown-up PIN.
- [x] Entering a valid Grown-up PIN on the Observatory opens the Control Center as that grown-up. A wrong PIN is refused, and repeated failures are rate-limited.
- [x] After a short idle period, the Observatory returns to the children's view.
- [x] The phone-setup QR code is only shown after PIN unlock. It signs in that grown-up only, works once and expires within minutes.
- [x] The Control Center can be installed as a PWA on a phone.

## Notes

- Unlocking is "tap yourself, then PIN" (like children tap themselves), so PINs only need to be unique to their owner. Grown-ups are shown by the first part of their email until they have display names. Only grown-ups with a PIN are offered.
- PINs are 4 to 8 digits, hashed with argon2 like passwords. Unlocking only works from a paired screen. After 5 wrong PINs an observatory refuses every PIN for 5 minutes; a right PIN before then resets the count.
- An unlocked session expires on the server after 10 minutes at most; the screen also locks itself after 90 seconds untouched, and has a Lock button.
- Phone setup: the unlocked observatory shows a QR of `/phone-setup.html#code=…`. The code is after `#`, so it never reaches the server's logs, and the page strips it from the address bar. It's single-use, valid 5 minutes, and gives the phone an ordinary (lasting) sign-in.
- "Pair a printer or scanner" moved from the children's screen into the unlocked Control Center, so children can't start pairing.
- The Control Center is installable: a web manifest, a minimal service worker (no caching; push arrives in ticket 17) and 192/512 px star icons rendered from the icon library.
- `/api/me` now includes the grown-up's id.
- The whole flow (unlock, Control Center on the observatory, phone QR, phone setup link, pairing code, lock) was walked through once in headless Chromium against the dev server.
