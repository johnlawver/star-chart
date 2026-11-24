# 01: Spike: the unit's printer prints a QR code a phone can scan

**What to find out:** whether the built-in thermal printer can print a QR code that a phone scans reliably, and how. This is one of the two hardware pieces the whole setup flow depends on.

**Blocked by:** None

**Status:** ready-for-human (the user, with the hardware, in a few days)

**Type:** prototype (throwaway firmware)

- [ ] Note the printer module, how it connects to the ESP32-S3 (serial TX/RX and baud rate, or something else), its print width in dots, and whether it has a built-in QR command (ESC/POS `GS ( k`).
- [ ] Print the Setup Guide QR from the spec (a link of about 250 characters) at two or three sizes, using the built-in command if it has one, otherwise as an image the ESP draws.
- [ ] Scan each with an iPhone and an Android phone, from a normal distance and in normal light. Record the smallest size that scans first time.
- [ ] Note anything that matters for the guide's layout, such as how long a print takes and whether large black areas fade or smear.
- [ ] Write the findings into this ticket under `## Comments`.
