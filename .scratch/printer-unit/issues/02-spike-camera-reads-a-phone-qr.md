# 02: Spike: the unit's camera reads a QR code off a phone screen

**What to find out:** whether the ESP32-S3's camera can read the Handshake QR from a phone screen quickly and reliably. This is the other hardware piece the setup flow depends on. The same camera will later read tickets for hand-ins.

**Blocked by:** None

**Status:** ready-for-human (the user, with the hardware, in a few days)

**Type:** prototype (throwaway firmware)

- [ ] Note the camera module (often an OV2640 or OV5640) and the board.
- [ ] Decode QR codes with Espressif's QR scanning component (`esp-code-scanner`, or `quirc` directly) at a low resolution such as QVGA, and print or log what it reads.
- [ ] Try a 150-character handshake (example in the spec) on an iPhone and an Android phone, at full and half brightness, at 10 to 30 cm. Record how long it takes to read and how often it fails.
- [ ] Try a printed ticket's QR code too, since the camera will read those for hand-ins.
- [ ] If phone glare is a problem, note what helps (distance, angle, a dark border around the QR on the page, a lower phone brightness).
- [ ] Write the findings into this ticket under `## Comments`, including the QR size and quiet zone the setup page should use.
