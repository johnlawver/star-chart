# 06: Rejection, Dismissal and every scan result

**What to build:** The rest of the ticket lifecycle and the scan feedback. A grown-up can **Reject** a handed-in ticket with an optional note (it goes back to Open), **Dismiss** any Open or Handed In ticket, and **Approve** an Open ticket that was never scanned. Each child can hold at most one open ticket per category. Every scan gives one of four results, and every action records who did it.

**Blocked by:** 05 (Hand in and approve)

**Status:** done

- [x] Rejection moves a ticket from Handed In to Open, with an optional note, and no stars.
- [x] Dismissal closes an Open or Handed In ticket with no stars (final).
- [x] A grown-up can approve an Open ticket directly.
- [x] Approved and Dismissed are final; any further transition is refused.
- [x] Scan results: *handed in*; *already handed in, waiting for a grown-up*; *nothing to hand in, already done* (with a small animation on screen); *not recognised*.
- [x] A child can't print a second ticket in a category where they already hold an Open or Handed In ticket, and the screen tells them why.
- [x] Each approval, rejection and dismissal records which grown-up did it.

## Notes from earlier tickets

- The test "a chore's code is the same every time it's printed for a child…" (in `test/chores.test.ts`) prints the same chore twice for one child while the first ticket is still open. Once the one-open-ticket-per-category rule lands here, that test needs the first ticket approved or dismissed before the second print.

## Notes

- Every grown-up decision goes through one rule table in the tickets module (`allowedFrom`): approve from Open or Handed In, reject from Handed In, dismiss from Open or Handed In. Approved and Dismissed are final. Refusals are 404 (no such ticket in this chart) or 409 (not allowed from its current state). Each decision locks the ticket, so stars can't be awarded twice by two grown-ups at once.
- One open ticket per child per category is checked before printing (so the child gets a clear reason) and enforced by a partial unique index (so two simultaneous taps can't both get through).
- Scan results: `handed-in`, `waiting-for-grown-up`, `already-done`, `not-recognised`.
- Who did what lives in a per-ticket history (`ticket_events`), ordered by a sequence number because two decisions can share a timestamp. A removed grown-up's entries show as "a former grown-up". Guests (ticket 15) will be added to this history.
- The ticket 04 stable-code test was updated to approve each ticket before printing the next, as predicted.
