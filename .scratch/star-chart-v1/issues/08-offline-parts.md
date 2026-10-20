# 08: Offline parts

**What to build:** The server tracks whether each part of an Observatory is connected. If a child tries to print while the Printer is offline, or the Scanner is offline, the Observatory screen shows a friendly message such as "the printer is napping, ask a grown-up". No ticket is created, and nothing is queued to print later. The Control Center shows each Observatory's parts and whether they're online.

**Blocked by:** 04 (Print a chore ticket)

**Status:** done

- [x] Printing while the Printer is disconnected fails with a reason the screen can display, and no ticket is created.
- [x] Nothing printed while a Printer is offline appears later when it reconnects.
- [x] The screen indicates when the Scanner is offline.
- [x] The Control Center lists each Observatory's parts with their online status.

## Notes from earlier tickets

- Until this ticket, printing when the observatory has no printer connected still creates the Open ticket and silently drops the print job. This ticket must refuse instead, and create no ticket.

## Notes

- Printing hands the job to the printer inside the transaction that creates the ticket; if no printer takes it, the transaction rolls back, so there's never a ticket nobody holds. The screen gets a 503 with `reason: "printer-offline"`.
- A heartbeat (every 15 seconds; `heartbeatMs` in the app config) pings every connected device and drops any that didn't answer the previous ping. Without it, a printer that loses power never says goodbye and would look online, swallowing print jobs. Browsers answer pings automatically; real hardware must too.
- Test live connections are now real network connections to a listening test server. The in-process WebSocket helper didn't pass a client's close on to the server, which hid how disconnects really behave.
- The ticket 03 pairing test now expects each part's online status in the observatory list.
