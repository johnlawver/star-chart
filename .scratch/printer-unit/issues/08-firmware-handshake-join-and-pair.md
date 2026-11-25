# 08: Firmware: read the handshake, join the Wi-Fi, pair, and print the result

**What to build:** The unit reads the Handshake QR, joins the Wi-Fi, pairs with the server named in it as a printer and scanner, saves its settings, and prints the outcome. It matches the fake unit's behaviour (ticket 06).

**Blocked by:** 02, 03, 04, 07

**Status:** ready-for-human (needs the hardware; an agent can help write it)

- [ ] It parses the handshake with the same rules as the shared parser's tests, and ignores QR codes that aren't `SC1` handshakes.
- [ ] It joins the network, checks the server's certificate with ESP-IDF's certificate bundle, pairs (`POST /api/parts {code, kind: "unit"}`), and saves the network, password, server and device token.
- [ ] It prints "All set! This printer belongs to <observatory or chart name>", or a failure slip with the reason and a fresh Setup Guide QR: wrong password or network not found (with the 2.4 GHz reminder), no internet, server unreachable or certificate rejected, or code expired or already used.
- [ ] After a successful setup, later power-ons skip the guide and connect straight away (ticket 09).
