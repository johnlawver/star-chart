# 15: Guest PINs

**What to build:** Any grown-up creates a **Guest PIN**, which expires after 12 hours by default or a chosen time, and can be cancelled early. A **Guest** enters it on the Observatory and gets a limited Control Center: approve, reject and dismiss tickets, and nothing else for now. Everything a guest does is recorded as done "by a guest".

**Blocked by:** 06 (Rejection, Dismissal and every scan result), 12 (Control Center on the Observatory)

**Status:** done

- [x] Any grown-up can create a Guest PIN with a default 12-hour expiry or a chosen one, and cancel it.
- [x] A valid Guest PIN on the Observatory opens a guest Control Center. Expired or cancelled PINs are refused (tested with the fake Clock).
- [x] Guests can approve, reject and dismiss tickets, and are refused everything else: setup, Redemptions, people, pairing.
- [x] Guest actions are recorded and shown as "by a guest".
- [x] When ticket 16 lands, guests can also handle Reprint Requests (that ticket covers it).

## Notes from earlier tickets

- Reprint requests (ticket 16) exist, with endpoints for grown-ups (`/api/reprint-requests`, approve, decline). Guests must be able to see and answer them too, and their decisions should be recorded as "by a guest" (reprint requests record `decided_by_grown_up_id` today).

## Notes

- The server picks each Guest PIN (6 random digits, never the same as another active one in the chart) and shows it once; a grown-up can add a label and choose 1 to 72 hours (12 by default). PINs are hashed like passwords.
- Signed-in actors are now grown-ups or guests. `requireGrownUp` refuses guests with 403 ("Guests can only handle tickets"); `requireActor` lets them in, and only the ticket and lost-ticket endpoints use it. Guests see and decide tickets and answer lost-ticket requests; nothing else.
- A guest's session ends after 10 minutes like a grown-up's, never outlasts its PIN, and cancelling the PIN ends it at once. Wrong Guest PINs count towards the observatory's 5-tries lockout.
- Guest decisions show as "a guest" in ticket history; lost-ticket answers record `decided_by_guest` (not shown anywhere yet).
- Checked once in a browser: Grown-ups → Guest → PIN pad → the guest view (waiting and lost tickets only) → Lock.
