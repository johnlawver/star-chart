# 06: Rejection, Dismissal and every scan result

**What to build:** The rest of the ticket lifecycle and the scan feedback. A grown-up can **Reject** a handed-in ticket with an optional note (it goes back to Open), **Dismiss** any Open or Handed In ticket, and **Approve** an Open ticket that was never scanned. Each child can hold at most one open ticket per category. Every scan gives one of four results, and every action records who did it.

**Blocked by:** 05 (Hand in and approve)

**Status:** ready-for-agent

- [ ] Rejection moves a ticket from Handed In to Open, with an optional note, and no stars.
- [ ] Dismissal closes an Open or Handed In ticket with no stars (final).
- [ ] A grown-up can approve an Open ticket directly.
- [ ] Approved and Dismissed are final; any further transition is refused.
- [ ] Scan results: *handed in*; *already handed in, waiting for a grown-up*; *nothing to hand in, already done* (with a small animation on screen); *not recognised*.
- [ ] A child can't print a second ticket in a category where they already hold an Open or Handed In ticket, and the screen tells them why.
- [ ] Each approval, rejection and dismissal records which grown-up did it.

## Notes from earlier tickets

- The test "a chore's code is the same every time it's printed for a child…" (in `test/chores.test.ts`) prints the same chore twice for one child while the first ticket is still open. Once the one-open-ticket-per-category rule lands here, that test needs the first ticket approved or dismissed before the second print.
