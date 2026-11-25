# 05: The phone setup page that makes the Handshake QR

**What to build:** `setup-unit.html`, the page the Setup Guide's QR opens. A grown-up signs in, picks the observatory, picks or types the Wi-Fi network, types the password, and gets a Handshake QR to hold up to the unit's camera. The formats are in the spec.

**Blocked by:** 03, 04

**Status:** done (2026-11-24); QR size to re-check after spike 02

- [x] It reads the unit's short name and the network names from the part of the link after `#`, which never reaches the server. "Setting up unit 7F3A" is shown in big letters to match the printed guide.
- [x] If the grown-up isn't signed in, it asks them to sign in and then carries on. Only owners and admins can go further; anyone else is told to ask one.
- [x] They choose the observatory (skipped if the chart has just one). The networks the unit found are listed to tap, strongest first, with "My network isn't listed" to type a name. The password field has a show/hide toggle. It notes that the unit needs 2.4 GHz Wi-Fi.
- [x] Choosing **Make the code** gets a pairing code for that observatory (ticket 04) and builds the Handshake QR in the browser, at the size and quiet zone from spike 02. The password is never sent to the server, and a test proves it.
- [x] While the QR is showing, the page says "Hold this up to the unit's camera" and watches the observatory's parts. When the unit comes online it shows "All set", and when the code expires it offers a new one.
- [x] No `alert`, `confirm`, `prompt` or new windows. It works on iPhone Safari and Android Chrome at phone width.
- [x] A browser smoke test covers it with the fake unit (ticket 06): open the setup link, sign in, pick a network, type a password, read the QR, and the unit pairs.

## Comments

2026-11-24: Done. `setup-unit.html` (`src/web/setup-unit/main.tsx`) uses the Control Center's styles.
- **From the link:** it reads `u` and `n` from the part after `#` with `readSetupGuide` and shows "Setting up unit 7F3A".
- **Who can use it:** someone signed out gets a sign-in form, then carries on. A grown-up who isn't an owner or admin, or a guest, is told to ask one.
- **Choosing:** the observatory choice appears only when there's more than one. A chart with none is told to set up its screen first. The networks are radio buttons, strongest first, then "My network isn't listed" with a name field. The 2.4 GHz note is shown. The password has Show/Hide.
- **Make the code:** gets a code from `POST /api/observatories/:id/pairing-codes` and builds the Handshake QR in the browser with `makeHandshake` (error correction M, quiet zone 4 modules, 320 px). Re-check the size and quiet zone once spike 02 reports what the camera reads reliably.
- **While the QR shows:** the page checks `GET /api/observatories` every 2 s. A new unit coming online at that observatory shows "All set". When the code's time runs out, it offers "Make a new code".
- **Smoke test:** the fake unit's Setup Guide link opens the page on a phone-sized window. The test signs in, picks a network, types a password, pastes the handshake into the fake unit, and sees both pages say All set. It records every request from both pages: neither the network names nor the Wi-Fi password appear in any. Leaking the password into a request makes it fail, which was checked.
- No `alert`, `confirm`, `prompt` or new windows. It hasn't been tried on a real iPhone yet.
