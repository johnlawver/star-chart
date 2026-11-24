# 09: Firmware: print tickets and scan hand-ins over the live connection

**What to build:** The paired unit does its everyday job. It keeps a live connection to the server (ADR 0003), prints tickets when a child picks a task, and reads tickets' QR codes for hand-ins.

**Blocked by:** 08

**Status:** ready-for-human (needs the hardware; an agent can help write it)

- [ ] It connects to `/api/parts/live`, sends its hello with its device token, answers the heartbeat, and reconnects with backoff after Wi-Fi or server drops, including after the router restarts.
- [ ] A `print` message prints the ticket: title, child, stars and its QR code, in a layout that works at the printer's width.
- [ ] The camera reads a ticket's QR code and sends a `scan` message, then shows the `scan-result` with a short printed slip or a beep or LED, whatever the hardware allows. The same ticket isn't sent twice in a row.
- [ ] If the server says the unit isn't paired any more (it was unpaired in the Control Center), it forgets its token and prints the Setup Guide.
