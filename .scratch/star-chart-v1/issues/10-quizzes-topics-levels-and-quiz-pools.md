# 10: Quizzes: Topics, Levels and Quiz Pools

**What to build:** Quiz categories (Task Kind: Quiz) contain **Topics**, such as Addition and Subtraction in Math. Grown-ups switch Topics on for each child, set each child's **Level** per Topic, and set a star value per Topic. Each child, Topic and Level has a **Quiz Pool**, filled through the quiz source port with built-in sample quizzes (Spelling, Math: Addition and Subtraction, Letters & Numbers), each with its answer key. At the Observatory, a category with one Topic switched on prints straight away; with several, the child picks a Topic. Each quiz ticket has a unique code and fixed content. Grown-ups see the answer key when approving. An empty pool recycles a quiz the child has done before and raises an alert.

**Blocked by:** 05 (Hand in and approve)

**Status:** done

- [x] Quiz is implemented as the second Task Kind behind the existing interface.
- [x] Grown-ups can create Topics in a quiz category with a star value, switch them on per child, and set a Level per child per Topic.
- [x] Pools are filled through one `addQuiz` function, used by grown-ups writing quizzes and by the built-in sample sets (and, in ticket 19, the quiz feed). Each quiz carries its answer key.
- [x] One Topic switched on: tapping the category prints. Several: the child picks a Topic first.
- [x] Each quiz ticket gets a unique opaque code and prints the quiz's content.
- [x] The Control Center shows the answer key next to a handed-in quiz.
- [x] Printing from an empty pool reuses a quiz the child has done before in that Topic, on a new ticket, and records a recycled-quiz alert.
- [x] When a pool runs out, grown-ups are notified (see notes: "ran out" rather than "below the threshold").
- [x] The one-open-ticket-per-category rule applies to quiz categories.

## Notes from earlier tickets

- Reprint requests (ticket 16) already exist and reprint a ticket exactly as stored on the ticket row (code, title, icon, stars). A quiz's printed content (its questions) must be stored on, or reachable from, the ticket, and included in the print job built for a reprint (`createReprints().approve` in `src/server/tickets/reprints.ts`), with a test that a reprinted quiz has the same questions.
- Push notifications (ticket 17) exist: `createNotifications().toChart(chartId, message)` sends to every subscribed grown-up in a chart. The pool-low and recycled-quiz alerts from ticket 17's criteria should be sent through it, with tests reading the fake push outbox.

## Shaped by the quiz feed (ticket 19, ADR 0004)

Build the pool so the quiz feed can plug in without rework:

- **Quiz content is structured:** a title, short instructions, and 1 to 20 Quiz Items, each a prompt and an answer. The print job carries the items (prompts only); the answer key is shown to grown-ups when approving. Sample quizzes use exactly this format.
- **Each quiz has an optional external id** (the feed's own id), unique within the chart, so a quiz sent twice isn't duplicated. Sample quizzes can leave it empty.
- **A pool is one child, one topic, one level.** Quizzes for a level the child isn't on stay in their pool but aren't printed.
- **Approving a quiz can record an optional Score** ("7 of 10"), shown next to the answer key, and kept for the feed's "what's done" list.
- **Load sample quizzes through the same internal function the feed will use**, so the format is proven on day one.
- **A topic with no quizzes and nothing to recycle** shows "No quizzes yet — ask a grown-up" and prints nothing.
- **Grown-ups set a target pool size per chart** (default 5). The pool-low alert (ticket 17) fires when a pool falls below it.

## Notes

- What prints when a child taps a topic, in order: the oldest quiz waiting in their pool (for their current level); a fresh quiz from the topic's built-in sample set, if it has one; the quiz they did least recently, reused (grown-ups are told); otherwise "No quizzes yet. Ask a grown-up!"
- Built-in sample sets: addition and subtraction (numbers grow with the level; never negative), letters (lowercase from level 2), numbers, and spelling (word lists by level). A test checks every set's answer key.
- Grown-ups can write quizzes themselves ("Write a quiz": one item per line as `prompt = answer`, or just a word to spell), which was the original "word lists" idea and goes through the same `addQuiz` the feed will use.
- Pool alerts: one when a pool runs out, and one whenever a quiz is reused. This replaces "below the target size", which would have notified on every print below target; the target size is what the quiz feed fills to (ticket 19). Topics with a sample set never run out, so they don't alert.
- Quizzes are ordered by a sequence number (migration 0026), since several can arrive at the same moment. Two prints at once take different quizzes (`FOR UPDATE SKIP LOCKED`).
- Approving a quiz can record a score; the ticket list shows the answer key and score. Reprints of a quiz are identical (ticket 16's carried-over item).
- On the observatory, a quiz category with one topic for the child prints straight away.
- Walked through once in a browser: one tap on Math printed a 10-problem addition quiz on the fake printer; pasting three words into "Write a quiz" added a three-item spelling quiz.
