# 16: Reprint Requests

**What to build:** A child with an open ticket taps "I lost it" at the Observatory, which creates a **Reprint Request**. A grown-up or guest approves or declines it in the Control Center. Approval reprints exactly the same ticket (same code and, for a quiz, same content) on that Observatory's Printer.

**Blocked by:** 06 (Rejection, Dismissal and every scan result), 10 (Quizzes)

**Status:** done (chores; quiz content and guests are carried by tickets 10 and 15)

- [x] From the category where they hold an open ticket, a child can send a Reprint Request.
- [x] Grown-ups see pending Reprint Requests and can approve or decline them. (Guests: ticket 15.)
- [x] Approval prints the same code and content. Decline prints nothing.
- [x] If the Printer is offline when a request is approved, the approval fails with a clear reason and nothing is queued.

## Notes

- Built before ticket 10 (quizzes): a reprint copies the ticket exactly as stored (code, title, icon, stars), so ticket 10 only has to make sure a quiz's printed content is stored on the ticket too. Noted on ticket 10.
- Guests handling reprint requests is left to ticket 15, since guests don't exist yet. Noted there.
- The copy prints on the observatory where the child asked. Approval hands the job to that printer inside the transaction; if no printer takes it, the request stays pending (503) and nothing is queued. If the ticket was approved or dismissed meanwhile, approving closes the request (409) and prints nothing.
- At most one pending request per ticket (enforced by a partial unique index). Requests record which grown-up answered them.
- Only Open tickets can be asked about; a handed-in ticket is already with a grown-up.
