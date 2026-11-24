# Spec: the printer-scanner unit and setting it up from a phone

**Status:** draft, agreed in conversation 2026-11-24. The hardware spikes (tickets 01 and 02) come first.

## The question

The observatory's printer and scanner will be one box: an ESP32-S3 with a camera and a built-in thermal printer. It has no screen and no keyboard. How does a family get it onto their Wi-Fi and paired with their chart, with nothing but a phone?

## The idea (the user's, 2026-11-24)

The printer is the unit's screen, and QR codes go both ways:

1. **First power-on:** the unit scans for nearby Wi-Fi networks, then prints a **Setup Guide** with a QR code.
2. **On the phone:** scanning it opens a setup page on the live Star Chart site. The phone uses its own internet connection, so the unit doesn't need to be online. A grown-up signs in, chooses which observatory the unit belongs to, picks the Wi-Fi network from the list the unit found (or types its name), and types the password.
3. **The handshake:** the phone shows a **Handshake QR** holding the Wi-Fi name and password, the server address and a one-time pairing code. The unit's camera reads it.
4. **The unit** saves it, joins the Wi-Fi, connects to the server, pairs and prints "All set!". If anything fails, it prints a slip saying what went wrong, with a fresh Setup Guide QR.

## Decisions

- **No hotspot, no Bluetooth.** The unit never runs its own Wi-Fi hotspot, and the phone never talks to it directly. Phone browsers can't scan Wi-Fi, and Web Bluetooth doesn't work in Safari, so camera plus printer is the one channel every phone can use. Recorded in ADR 0005.
- **The unit finds the networks.** Phone browsers can't list Wi-Fi networks, so the unit scans for them at power-on and puts the strongest few names in the Setup Guide's QR, after the `#` in the link. The part after `#` stays on the phone, so network names never reach the server. If a network isn't listed (hidden, or too many to fit), the grown-up types its name.
- **The Wi-Fi password never reaches the server.** It goes from the phone's screen, through the Handshake QR, straight into the unit. The setup page builds the Handshake QR in the browser.
- **The server address comes from the handshake.** The unit's firmware has a default setup address for the printed QR (the live site). The handshake then tells the unit which server to use, so the same firmware works with any Star Chart server, including a developer's.
- **One box, two jobs.** The unit pairs once, as both its observatory's printer and its scanner, with one credential. Ticket 03 sets out how.
- **Pairing codes come from the Control Center.** Today a pairing code is made on an unlocked observatory screen. The setup page needs one too, made by a signed-in owner or admin for an observatory they choose. The code works the same way: one use, 10 minutes.
- **The unit trusts real certificates.** ESP-IDF's built-in certificate bundle includes Google Trust Services and Let's Encrypt, so the unit checks the server's certificate normally. Plain `http://` is only allowed for development servers, and only if the firmware is built with that option.
- **2.4 GHz only.** The ESP32-S3 can't join 5 GHz-only networks, enterprise (802.1X) networks, or networks with a sign-in page. The setup page says so, and the unit's failure slip names the likely reason.

## Formats

**Setup Guide QR (printed by the unit):**

```
https://star-chart.johnlawver.com/setup-unit.html#u=<unit>&n=<name1>&n=<name2>...
```

- `u`: the unit's short name, the last 4 hex digits of its Wi-Fi MAC address (such as `7F3A`). It's printed in big letters on the guide, so a family with two units can tell which is which.
- `n`: a network name the unit found, URL-encoded, strongest first. Up to 8 names, and the whole link stays under 300 characters (drop names to fit), so the printed QR stays easy to scan.

**Handshake QR (shown by the phone):**

```
SC1;S:<network name>;P:<password>;H:<server>;C:<pairing code>;;
```

- Modelled on the standard `WIFI:` QR format. `\`, `;`, `,`, `:` and `"` in a value are escaped with a backslash.
- `SC1` is the format and version, so the unit can tell the handshake apart from a ticket's QR code and refuse a future version it doesn't understand.
- `H` is the server's address, such as `https://star-chart.johnlawver.com`.
- `P` is left empty for an open network.
- A typical handshake is under 150 characters, which keeps the QR small and readable by a modest camera off a glossy phone screen.

## Out of scope for now

- Firmware updates over the air.
- Moving a paired unit to a different Wi-Fi network without a reset. A reset and a fresh setup handle it for now.
- Encrypting the unit's storage (flash encryption). Worth doing before units leave the house.
