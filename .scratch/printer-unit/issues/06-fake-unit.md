# 06: A fake unit, for building and testing setup without the hardware

**What to build:** A development page, `fake-unit.html`, that behaves like the real unit, the same way the fake printer and fake scanner stand in for theirs today. With it, the setup page and pairing can be built and tested end to end before the firmware exists, and the firmware has a reference to match.

**Blocked by:** 03

**Status:** done (2026-11-24)

- [x] At "power-on" it shows the Setup Guide it would print, including its QR (pointing at the server it's running on) and a few made-up network names.
- [x] It reads a Handshake QR, either with the computer's webcam or by pasting the text. It checks the `SC1` version, shows what it would join ("Joining HomeWiFi…", with the password hidden), then pairs as a printer and scanner with the code and connects to the server it was given.
- [x] Once paired it shows printed tickets and can scan a ticket's code by typing it, like the fake printer and scanner together, and it prints "All set!" in its print area.
- [x] It shows the failure slips the real unit would print: unreadable or wrong-version QR, a code that's expired or already used, and a server it can't reach.
- [x] A "Reset" button forgets everything and goes back to the Setup Guide.
- [x] Development builds only (left out when `STAR_CHART_RELEASE=true`), like the Art Gallery.
- [x] The parser for the handshake format is shared code with its own tests (escaping, an empty password, an unknown version), so the setup page and the fake unit can't drift apart.

## Comments

2026-11-24: Done. `fake-unit.html` (`src/web/fake-unit/main.tsx`) is in development builds only, next to the Art Gallery in `vite.config.ts`.
- **Setup Guide:** it shows its slip, with a 4-hex name kept across resets, a QR of `setupGuideLink(location.origin, …)` and three made-up networks.
- **Reading a handshake:** it reads a Handshake by pasted text, or by webcam where the browser has `BarcodeDetector` (Chrome on macOS and Android). It shows "Joining <network>…" with the password hidden, then pairs with `POST <H>/api/parts {code, kind: "unit"}` and connects its live connection to `H` (`useLiveConnection` now takes an optional server).
- **Failure slips:** not a setup code, a newer version ("I need an update"), a code that's expired or used, too many tries, and a server it can't reach.
- **Once paired:** it prints "All set!", then receipts, and scans typed codes. Reset forgets everything except its name.
- **Shared code:** the formats are in `src/web/shared/unit-setup.ts` (`makeHandshake`, `readHandshake`, `setupGuideLink`, `readSetupGuide`), tested in `test/unit-setup-formats.test.ts`. The receipt drawing moved to `src/web/fake-parts/receipt.tsx`.
- **Smoke test:** it covers the guide link, all three failure slips, pairing, printing, and scanning ("handed-in").
- **Talking to another server:** a fake unit pointed at a different server than the one it's served from would need that server to allow cross-origin requests. The real unit has no such limit.
