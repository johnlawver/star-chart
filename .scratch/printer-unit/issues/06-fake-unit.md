# 06: A fake unit, for building and testing setup without the hardware

**What to build:** A development page, `fake-unit.html`, that behaves like the real unit, the same way the fake printer and fake scanner stand in for theirs today. With it, the setup page and pairing can be built and tested end to end before the firmware exists, and the firmware has a reference to match.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] At "power-on" it shows the Setup Guide it would print, including its QR (pointing at the server it's running on) and a few made-up network names.
- [ ] It reads a Handshake QR, either with the computer's webcam or by pasting the text. It checks the `SC1` version, shows what it would join ("Joining HomeWiFi…", with the password hidden), then pairs as a printer and scanner with the code and connects to the server it was given.
- [ ] Once paired it shows printed tickets and can scan a ticket's code by typing it, like the fake printer and scanner together, and it prints "All set!" in its print area.
- [ ] It shows the failure slips the real unit would print: unreadable or wrong-version QR, a code that's expired or already used, and a server it can't reach.
- [ ] A "Reset" button forgets everything and goes back to the Setup Guide.
- [ ] Development builds only (left out when `STAR_CHART_RELEASE=true`), like the Art Gallery.
- [ ] The parser for the handshake format is shared code with its own tests (escaping, an empty password, an unknown version), so the setup page and the fake unit can't drift apart.
