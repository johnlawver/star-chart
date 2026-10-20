# 04: Print a chore ticket

**What to build:** A grown-up creates a Chores **Task Category** (Task Kind: Chore) and a **Chore** with a name and star value, assigned to particular children. At the Observatory, the child taps their tab, then Chores, then the chore, and a **Ticket** appears on the fake Printer showing the child's nickname, the chore and a QR code. The chore's code is stable for that child and chore (ADR 0001). The Task Kind interface is introduced here, with Chore as its first implementation.

**Blocked by:** 03 (Pair an Observatory and fake parts)

**Status:** ready-for-agent

- [ ] A grown-up can create a Task Category with a Task Kind, and add Chores with a name, star value and the children they're assigned to.
- [ ] A child sees only categories that contain something assigned to them, and only their own chores.
- [ ] Printing a chore creates an Open ticket and sends a print job to that Observatory's Printer. The fake Printer shows it as a receipt-width black-and-white ticket.
- [ ] The chore's code is an opaque, unguessable token, the same every time it's printed for that child and chore, and different for each child.
- [ ] Task Kinds sit behind one interface (what a child can choose, how a ticket's code and content are produced, what a hand-in counts towards), with Chore implemented.
- [ ] A browser smoke test checks that the Observatory loads, a child can be chosen, and a tap produces a print job on the fake Printer.
