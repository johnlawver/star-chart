# 03: Pair an Observatory and fake parts

**What to build:** The Owner signs in on an unpaired **Observatory** screen, which pairs it to their Chart, and it stays signed in. A fake **Printer** page and a fake **Scanner** page each pair to that Observatory with a pairing code. Every part gets its own revocable device credential and holds a live connection *outward* to the server (ADR 0003). The Observatory screen shows the Chart's children, and a child can tap their own tab.

**Blocked by:** 02 (Children)

**Status:** ready-for-agent

- [ ] Signing in on a fresh Observatory as the Owner pairs it to the Chart, and it stays paired across restarts.
- [ ] A fake Printer page and a fake Scanner page can each be paired to a specific Observatory by entering a pairing code shown for that Observatory.
- [ ] Each part uses its own device credential, never a grown-up's login. Unpairing an Observatory revokes all its parts.
- [ ] Parts only ever connect outward to the server; the server never initiates a connection to a device.
- [ ] The Observatory screen lists the Chart's children, and tapping one opens that child's (still mostly empty) view.
- [ ] The screen stays deliberately plain (see Project conventions in `CLAUDE.md`).
- [ ] A device from one Chart can't see or act on another Chart (API test).
