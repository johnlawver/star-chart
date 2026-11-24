# 07: Firmware: on first boot, scan Wi-Fi and print the Setup Guide

**What to build:** Real firmware for the unit, from power-on to a printed Setup Guide. Builds on what spike 01 learned about the printer.

**Blocked by:** 01

**Status:** ready-for-human (needs the hardware; an agent can help write it)

- [ ] On power-on with no saved settings, the unit scans for Wi-Fi networks and prints the Setup Guide: a short "Let's set up your Star Chart printer" heading, the unit's short name in big letters, the QR (format in the spec, up to 8 networks, under 300 characters), and three numbered steps.
- [ ] Its default setup address is a build setting, with the live site as the default.
- [ ] Then it waits, with the camera looking for a Handshake QR (ticket 08).
- [ ] Firmware source lives in this repo (for example `firmware/unit/`, ESP-IDF), with its own README covering building, flashing and the build settings.
