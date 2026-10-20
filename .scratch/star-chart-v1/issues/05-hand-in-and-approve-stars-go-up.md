# 05: Hand in and approve: stars go up

**What to build:** The first complete loop. The child types the ticket's code into the fake Scanner, which is a **Hand-in**. The Observatory screen shows "handed in, waiting for a grown-up!" and the ticket becomes **Handed In**. A grown-up sees it in the Control Center and **Approves** it, optionally overriding the star value. The stars are recorded in the child's star record, and the **Balance** shown on the Observatory goes up.

**Blocked by:** 04 (Print a chore ticket)

**Status:** done

- [x] A code sent by a Scanner moves the child's Open chore ticket to Handed In, and the Observatory that scanner belongs to shows the "waiting for a grown-up" feedback.
- [x] The Control Center lists Handed In tickets.
- [x] Approving a ticket marks it Approved (final) and adds its star value to the child's star record. A grown-up can override the star value when approving.
- [x] The Balance is always computed from the star record, never stored separately, and appears on the child's Observatory view.
- [x] A code from another Chart is "not recognised" (API test).

## Notes

- The observatory screen now holds its own live connection (the same `/api/parts/live` with a hello), so it hears scan results. A scanner sends `{ "type": "scan", "code": … }`, and the screen and the scanner both get `{ "type": "scan-result", "result": "handed-in" | "not-recognised", … }`.
- Stars live in an append-only star record (`star_movements`). The balance is always summed from it, never stored. Approval and its star movement are written in one transaction.
- So far only "handed-in" and "not-recognised" scan results exist, and only Handed In tickets can be approved. Ticket 06 adds the rest of the results, approving Open tickets, and refusing changes to final tickets.
- If the same chore has two open tickets for a child (possible until ticket 06's one-open-per-category rule), one scan hands in both.
- Checked end to end against the running dev server: print, scan, the screen hears it, approve, balance 2.
