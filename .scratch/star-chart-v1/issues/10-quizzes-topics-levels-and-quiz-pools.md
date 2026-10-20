# 10: Quizzes: Topics, Levels and Quiz Pools

**What to build:** Quiz categories (Task Kind: Quiz) contain **Topics**, such as Addition and Subtraction in Math. Grown-ups switch Topics on for each child, set each child's **Level** per Topic, and set a star value per Topic. Each child, Topic and Level has a **Quiz Pool**, filled through the quiz source port with built-in sample quizzes (Spelling, Math: Addition and Subtraction, Letters & Numbers), each with its answer key. At the Observatory, a category with one Topic switched on prints straight away; with several, the child picks a Topic. Each quiz ticket has a unique code and fixed content. Grown-ups see the answer key when approving. An empty pool recycles a quiz the child has done before and raises an alert.

**Blocked by:** 05 (Hand in and approve)

**Status:** ready-for-agent

- [ ] Quiz is implemented as the second Task Kind behind the existing interface.
- [ ] Grown-ups can create Topics in a quiz category with a star value, switch them on per child, and set a Level per child per Topic.
- [ ] The quiz source port fills pools. The v1 source supplies the sample quizzes, each with an answer key.
- [ ] One Topic switched on: tapping the category prints. Several: the child picks a Topic first.
- [ ] Each quiz ticket gets a unique opaque code and prints the quiz's content.
- [ ] The Control Center shows the answer key next to a handed-in quiz.
- [ ] Printing from an empty pool reuses a quiz the child has done before in that Topic, on a new ticket, and records a recycled-quiz alert.
- [ ] A pool falling below the configured threshold records a pool-low alert. Push delivery comes in ticket 17.
- [ ] The one-open-ticket-per-category rule applies to quiz categories.

## Notes from earlier tickets

- Reprint requests (ticket 16) already exist and reprint a ticket exactly as stored on the ticket row (code, title, icon, stars). A quiz's printed content (its questions) must be stored on, or reachable from, the ticket, and included in the print job built for a reprint (`createReprints().approve` in `src/server/tickets/reprints.ts`), with a test that a reprinted quiz has the same questions.
