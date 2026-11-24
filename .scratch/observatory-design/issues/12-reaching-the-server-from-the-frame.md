# 12: Reaching the server from the frame

**What to build:** The frame loads the observatory from the server at home and stays paired. Today the server is reached at `https://mini.wolverine-pumpkinseed.ts.net` through Tailscale, which the frame can't use:
- it can't run Tailscale on Android 6;
- it can't resolve `.local` names;
- it doesn't trust Let's Encrypt certificates, which Tailscale's are (no ISRG Root X1).

**Blocked by:** None (needs a decision first)

**Status:** needs-info

Choose one:

- **A. Keep HTTPS (recommended).**
  - On the rooted frame, add ISRG Root X1 to Android's system certificate store. It's a real, widely trusted root that Android 6 simply predates, so this isn't bypassing any check.
  - Add a hosts entry so `mini.wolverine-pumpkinseed.ts.net` points at the Mac mini's home-network address.
  - The server also listens on the home network over HTTPS, using the same Tailscale certificate, renewed automatically.
  - The frame then uses exactly the same address as phones. PINs and the device credential never cross the Wi-Fi in clear, and the "HTTPS everywhere" rule holds.
- **B. Plain HTTP on the home network for the frame only.**
  - The server also listens on its home-network IP over HTTP (with a DHCP reservation for the Mac mini).
  - Simpler to set up, but the screen's device credential and any Grown-up or Guest PIN typed on the frame cross the home Wi-Fi unencrypted. It would need an exception to the "HTTPS everywhere" convention in CLAUDE.md.

Once decided:
- [ ] The kiosk's saved URL opens the observatory on the frame after a cold boot, without Tailscale.
- [ ] Pairing the frame (sign in on the device) works, and survives a reboot.
- [ ] The live connection (WebSocket) works from the frame.
- [ ] Phones keep working at the Tailscale address unchanged.
- [ ] The frame's setup (certificate, hosts entry or IP, kiosk URL over ADB) is written down step by step in the README, or as a wizard script if there are many steps.
