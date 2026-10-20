# 03: Pair an Observatory and fake parts

**What to build:** The Owner signs in on an unpaired **Observatory** screen, which pairs it to their Chart, and it stays signed in. A fake **Printer** page and a fake **Scanner** page each pair to that Observatory with a pairing code. Every part gets its own revocable device credential and holds a live connection *outward* to the server (ADR 0003). The Observatory screen shows the Chart's children, and a child can tap their own tab.

**Blocked by:** 02 (Children)

**Status:** done

- [x] Signing in on a fresh Observatory as the Owner pairs it to the Chart, and it stays paired across restarts.
- [x] A fake Printer page and a fake Scanner page can each be paired to a specific Observatory by entering a pairing code shown for that Observatory.
- [x] Each part uses its own device credential, never a grown-up's login. Unpairing an Observatory revokes all its parts.
- [x] Parts only ever connect outward to the server; the server never initiates a connection to a device.
- [x] The Observatory screen lists the Chart's children, and tapping one opens that child's (still mostly empty) view.
- [x] The screen stays deliberately plain (see Project conventions in `CLAUDE.md`).
- [x] A device from one Chart can't see or act on another Chart (API test).

## Notes

- Pages: the observatory screen is at `/observatory.html`, and the fake parts at `/fake-printer.html` and `/fake-scanner.html`.
- Every device (screen, printer, scanner) has its own random credential, stored only as a hash. Devices send it as `Authorization: Bearer …`. On the live connection (`/api/parts/live`, a WebSocket) the first message is `{ "type": "hello", "deviceToken": … }`, so the credential never appears in a URL. An unrecognised or revoked credential gets the connection closed with code 4401.
- Pairing codes are 8 characters from an alphabet without look-alikes, stored only as a hash, single-use and valid for 10 minutes.
- Pairing and unpairing are owner-only for now; ticket 13 opens them to admins.
- The screen doesn't hold a live connection yet; it gets one when it needs to show scan feedback (ticket 05).
- Checked end to end against the running dev server over real HTTP and WebSocket, in addition to the API tests.
