# 08: Offline parts

**What to build:** The server tracks whether each part of an Observatory is connected. If a child tries to print while the Printer is offline, or the Scanner is offline, the Observatory screen shows a friendly message such as "the printer is napping, ask a grown-up". No ticket is created, and nothing is queued to print later. The Control Center shows each Observatory's parts and whether they're online.

**Blocked by:** 04 (Print a chore ticket)

**Status:** ready-for-agent

- [ ] Printing while the Printer is disconnected fails with a reason the screen can display, and no ticket is created.
- [ ] Nothing printed while a Printer is offline appears later when it reconnects.
- [ ] The screen indicates when the Scanner is offline.
- [ ] The Control Center lists each Observatory's parts with their online status.

## Notes from earlier tickets

- Until this ticket, printing when the observatory has no printer connected still creates the Open ticket and silently drops the print job. This ticket must refuse instead, and create no ticket.
