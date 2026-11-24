# 05: The phone setup page that makes the Handshake QR

**What to build:** `setup-unit.html`, the page the Setup Guide's QR opens. A grown-up signs in, picks the observatory, picks or types the Wi-Fi network, types the password, and gets a Handshake QR to hold up to the unit's camera. The formats are in the spec.

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [ ] It reads the unit's short name and the network names from the part of the link after `#`, which never reaches the server. "Setting up unit 7F3A" is shown in big letters to match the printed guide.
- [ ] If the grown-up isn't signed in, it asks them to sign in and then carries on. Only owners and admins can go further; anyone else is told to ask one.
- [ ] They choose the observatory (skipped if the chart has just one). The networks the unit found are listed to tap, strongest first, with "My network isn't listed" to type a name. The password field has a show/hide toggle. It notes that the unit needs 2.4 GHz Wi-Fi.
- [ ] Choosing **Make the code** gets a pairing code for that observatory (ticket 04) and builds the Handshake QR in the browser, at the size and quiet zone from spike 02. The password is never sent to the server, and a test proves it.
- [ ] While the QR is showing, the page says "Hold this up to the unit's camera" and watches the observatory's parts. When the unit comes online it shows "All set", and when the code expires it offers a new one.
- [ ] No `alert`, `confirm`, `prompt` or new windows. It works on iPhone Safari and Android Chrome at phone width.
- [ ] A browser smoke test covers it with the fake unit (ticket 06): open the setup link, sign in, pick a network, type a password, read the QR, and the unit pairs.
