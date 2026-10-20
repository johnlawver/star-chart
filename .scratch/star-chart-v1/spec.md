# Spec: Star Chart v1 (the whole loop, web first, fake hardware)

Status: ready-for-agent

Terms in **bold** are defined in `CONTEXT.md`. Relevant decisions: ADR 0001 (stable QR codes for chore tickets), ADR 0002 (multi-tenant from day one), ADR 0003 (devices connect outward to the server). Standing rules are in the "Project conventions" section of `CLAUDE.md`.

## Problem Statement

We want our children, Nova (6) and Pip (3), to do chores and practise spelling, math, and letters and numbers, and to feel rewarded for it. Sticker charts and verbal reminders don't hold their attention, and keeping track of who did what, and what they've earned, is tedious for us.

We want something physical and fun: the kids choose what to do on a screen, get a printed ticket, do the task, scan the ticket to hand it in, and watch their stars grow. Grown-ups confirm the work from a phone, without bookkeeping.

The hardware (screen, receipt printer, QR camera) is still undecided. We want the whole system working end to end in software first, with fake devices, so it's proven before any time goes into hardware. It also has to be built so it could later become a hosted service for other households and classrooms.

## Solution

Star Chart v1 is a web system with three faces:

- **Observatory** screen: a touchscreen web page in kiosk mode. A **Child** taps their own tab, sees their **Balance** and **Constellation**, and taps a **Task Category** (and, if needed, a **Topic**) to print a **Ticket**. When they scan a ticket, the screen shows clear feedback: handed in, waiting for a grown-up, or already done.
- **Control Center**: the grown-up side. It opens on the observatory behind a **Grown-up PIN** (or a **Guest PIN**) and can be installed on a phone as a PWA with push notifications. Grown-ups set up the **Chart**, children, categories, chores and topics there; approve, reject and dismiss tickets; record **Redemptions**; and manage other grown-ups and observatories.
- **Fake devices**: a fake **Printer** that shows each printed ticket on screen, and a fake **Scanner** where you type or paste a ticket's code. They connect to the server exactly as real parts will, so real hardware can replace them later without changing anything else.

Everything runs locally in Docker with a real Postgres database. Secrets come from Doppler. The observatory screen is deliberately plain; its look and feel come in a later, dedicated design phase.

## User Stories

### Setting up

1. As a new grown-up, I want to sign in on a fresh observatory's screen and create a chart, so that setting up starts at the device itself.
2. As the grown-up who creates a chart, I want to become its **Owner** automatically, so that someone is always in charge.
3. As an owner, I want to set my chart's name and time zone, so that "today", chore frequencies and the Daily Summary match where we live.
4. As a grown-up, I want to set a personal Grown-up PIN, so that I can open the Control Center on the observatory without typing my password.
5. As a grown-up in the Control Center on the observatory, I want to show a QR code that installs the Control Center on my phone and signs me in, so that I can get notifications and work from anywhere.
6. As a grown-up, I want the phone-setup QR code to be single-use, short-lived and tied to me, so that someone else in the room can't use it to get into my account.
7. As a grown-up, I want to sign up and sign in on the web without an observatory, so that I can set things up before the hardware exists or when I'm away from home.
8. As a grown-up, I want to sign in with an email and password, so that my account is protected.
9. As a grown-up, I want to reset a forgotten password by email, so that I'm never locked out.
10. As an owner or admin, I want to send an **Invitation** by email, so that my partner or a co-teacher can join the chart.
11. As an invited person, I want to accept an invitation and create my login, so that I join the right chart as a grown-up.
12. As an owner, I want to promote a grown-up to **Admin** and demote them again, so that I can share the work of managing the chart.
13. As an owner, I want to transfer ownership to an admin, so that someone else can take over the chart.
14. As an owner, I want to be stopped from leaving the chart until I've transferred ownership, so that a chart is never left without an owner.
15. As an owner, I want to delete the whole chart, so that all our data is gone if we stop using Star Chart.
16. As an owner or admin, I want to remove a grown-up, so that people who no longer help can't get in. (Only the owner can remove an admin.)
17. As a grown-up, I want to add a **Child** with just a nickname, so that we store as little as possible about our children.
18. As a grown-up, I want to set each child's **Display Style** to pictures or words, so that Pip sees **Icons** and Nova sees text.
19. As a grown-up, I want to rename or remove a child, so that the chart stays accurate.

### Pairing observatories and parts

20. As an owner or admin, I want to pair another observatory to our chart, so that we can have one upstairs and one downstairs, or several in a classroom.
21. As a grown-up who isn't an admin, I want a clear "ask an admin to set this up" message on an unpaired observatory, so that I know why I can't pair it.
22. As an owner or admin, I want to unpair an observatory, so that a lost or retired screen no longer has access.
23. As an owner or admin, I want to pair a fake printer and a fake scanner to an observatory using a pairing code, so that I can test the whole flow without hardware.
24. As an owner or admin, I want to see each observatory's parts and whether they're online, so that I can see at a glance when something is broken.
25. As a paired observatory, I want to stay signed in after restarts, so that grown-ups don't have to sign in every morning.

### Categories, chores and topics

26. As a grown-up, I want to create a Task Category and choose its **Task Kind** (chores or quizzes), so that we can add new kinds of activity later.
27. As a grown-up, I want to give every category, chore and topic an Icon from a built-in library, so that children who can't read can still choose.
28. As a grown-up, I want to add a **Chore** with a name, icon, star value and **Frequency**, so that the kids can earn stars for it.
29. As a grown-up, I want to assign each chore to particular children, so that Pip gets "put toys away" and Nova gets "feed the cat".
30. As a grown-up, I want most chores to default to once per day, so that I rarely have to think about frequency.
31. As a grown-up, I want to add Topics to a quiz category, such as Addition and Subtraction within Math, each with its own star value, so that harder topics can be worth more.
32. As a grown-up, I want to switch topics on for each child, so that each child only sees what suits them.
33. As a grown-up, I want to set each child's **Level** in each topic, so that quizzes match what they can do.
34. As a grown-up, I want to edit or retire chores, topics and categories, so that the chart grows with the kids.

### Children at the observatory

35. As a child, I want to tap my own tab first, so that everything I see after that is mine.
36. As a child, I want to see my balance straight away, so that I know how many stars I have.
37. As a child, I want to see my Constellation, so that I can watch my stars build up over time.
38. As a child, I want to see only the categories that have something switched on for me, so that I'm not confused by things that aren't mine.
39. As a child who sees pictures, I want every button and ticket to show big icons, so that I don't need to read.
40. As a child, I want to tap Chores and choose one of my chores that's available now, so that I can print it.
41. As a child, I want a chore that's already been approved within its frequency period to be hidden or shown as done, so that I know I've finished it for today.
42. As a child, I want to tap a quiz category and get a quiz straight away if I only have one topic there, so that it's quick.
43. As a child with several topics in a category, I want to tap the category and then pick a topic, so that I choose what I practise.
44. As a child, I want to be told when I already have an open ticket in a category, so that I finish it before starting another.
45. As a child who has lost a ticket, I want to tap "I lost it" to send a **Reprint Request**, so that a grown-up can get me a new copy.
46. As a child, I want to scan my finished ticket and see a happy "handed in, waiting for a grown-up!" message, so that I know it worked.
47. As a child, I want to see "already done!" with a little animation if I scan a ticket that has nothing left to hand in, so that I'm not confused.
48. As a child, I want to see "waiting for a grown-up" if I scan a ticket that's already handed in, so that I know someone still needs to check it.
49. As a child, I want a friendly message if the printer or scanner is offline, such as "the printer is napping, ask a grown-up", so that nothing prints later out of nowhere.
50. As a child, I want to see my balance go up once a grown-up approves my ticket, so that I feel rewarded.

### Tickets

51. As a child, I want my chore ticket to carry the same code every time it's printed for me, so that an old or laminated slip still works.
52. As a grown-up, I want every chore code to belong to one child, so that the right child gets the stars without having to say who they are.
53. As a grown-up, I want every quiz ticket to have its own unique code and fixed content, so that a reprint gives exactly the same quiz.
54. As a grown-up, I want each child to hold at most one open ticket per category, so that nobody prints a pile of tickets.
55. As a grown-up, I want a scan from any of our observatories to work for any of our tickets, so that it doesn't matter where a ticket was printed.
56. As a grown-up, I want codes from another chart to be rejected, so that charts never mix.

### Grown-ups handling tickets

57. As a grown-up, I want a push notification when a ticket is handed in, so that I can check the work promptly.
58. As a grown-up, I want a list of handed-in tickets waiting for me, so that I can work through them in one go.
59. As a grown-up, I want to **Approve** a ticket and award its stars, so that the child is rewarded.
60. As a grown-up, I want to override the star value when approving, so that I can give a bonus or partial credit.
61. As a grown-up, I want to approve an open ticket that was never scanned, so that a broken scanner or a chore I watched being done doesn't hold things up.
62. As a grown-up, I want to **Reject** a handed-in ticket with an optional note, so that the child knows to try again, and the ticket goes back to open.
63. As a grown-up, I want to **Dismiss** any open or handed-in ticket, so that a lost quiz or a chore someone else already did doesn't block the child.
64. As a grown-up, I want a push notification for a Reprint Request, and to approve or decline it, so that reprints only happen when a ticket is really lost.
65. As a grown-up, I want to see each quiz's answer key next to it when approving, so that checking is quick.
66. As a grown-up, I want to see who approved, rejected or dismissed each ticket, so that we know what happened.

### Guests

67. As a grown-up, I want to create a Guest PIN for the babysitter that expires after 12 hours by default, or after a time I choose, so that I don't have to give out my login.
68. As a grown-up, I want to cancel a Guest PIN early, so that I'm in control.
69. As a **Guest**, I want to enter the Guest PIN on the observatory and approve, reject and dismiss tickets and handle Reprint Requests, so that the kids still get their stars while the parents are out.
70. As a grown-up, I want guests to be unable to change setup, record redemptions or manage people, so that a babysitter can't change anything important.
71. As a grown-up, I want everything a guest did to be marked as done by a guest, so that I can see what happened while I was out.

### Stars

72. As a grown-up, I want to record a Redemption with an amount and a note, so that we track what stars were spent on.
73. As a grown-up, I want a redemption larger than the child's balance to be refused, so that balances never go negative.
74. As a grown-up, I want to see each child's Constellation (every star earned and spent, over time) in the Control Center, so that I can see their progress.
75. As a child, I want my balance to be exactly what I've earned minus what I've spent, so that it's always fair.

### Quiz content

76. As a grown-up, I want each topic to draw quizzes from a **Quiz Pool** for each child at their current level, so that printing is instant.
77. As a grown-up, I want the pool to start with sample quizzes for Spelling, Math (Addition, Subtraction) and Letters & Numbers, so that we can use it before the quiz-making agent exists.
78. As a grown-up, I want a notification when a child's pool for a topic is running low, so that I can top it up before it runs out.
79. As a child whose pool is empty, I want to get a quiz I've done before rather than nothing, so that the button never stops working.
80. As a grown-up, I want to be alerted when a recycled quiz is printed, so that I know the pool needs refilling.
81. As the future quiz-making agent, I want a single way to add quizzes (content plus answer key) to a child's pool for a topic and level, so that I can top up pools without touching anything else.

### Notifications

82. As a grown-up, I want push notifications on my phone through the installed Control Center, so that I don't need a native app.
83. As a grown-up, I want hand-in notifications grouped when several arrive close together, so that a busy morning doesn't send ten pings.
84. As a grown-up, I want a Daily Summary at 7pm in the chart's time zone, showing each child's stars earned that day and their open tickets, so that I know where things stand.

### Operating it

85. As the person running Star Chart, I want to start everything locally with Docker and Doppler, so that development matches how it will run.
86. As the person running Star Chart, I want a setting that turns off creating new charts, so that the server I host at home isn't open to strangers.
87. As the person running Star Chart, I want database changes applied as migrations, so that upgrading never loses data.
88. As the person running Star Chart, I want emails caught locally in development, so that I can test invitations and password resets without sending real mail.

## Implementation Decisions

### Stack and shape

- TypeScript throughout. A single Node server provides the API and serves both web front ends: the observatory screen and the Control Center PWA. Postgres runs in Docker, and every schema change is a migration from the very first table.
- All settings and secrets come from environment variables injected by Doppler (`doppler run`). There are no committed `.env` files.
- HTTPS everywhere, including at home. PWA installation and web push require it.
- Every row of domain data belongs to a Chart, and every query is scoped by chart (ADR 0002). A grown-up login and a child each belong to exactly one chart.

### Modules

The server is organised as a few deep modules, each with a small public interface. The front ends and devices only ever talk to the server's public API.

1. **Charts and people**
   - Owns charts (name, time zone), grown-ups, roles (Owner, Admin, plain grown-up), Invitations, children (nickname and display style only), Grown-up PINs and Guest PINs.
   - Provides authentication: email and password, password reset by email, and sessions.
   - Answers one question for every other module: *who is acting, and what may they do?* The actor is a grown-up, a guest or a paired device.
   - Role rules:
     - Every grown-up can do everything day to day: children, categories, chores, topics, levels, ticket handling and redemptions.
     - Admins can also invite and remove grown-ups, and pair and unpair observatories.
     - Only the Owner can promote, demote and remove admins, transfer ownership and delete the chart.
     - Guests can only approve, reject and dismiss tickets and handle Reprint Requests.
   - The owner cannot leave without transferring ownership.

2. **Catalog**
   - Owns Task Categories (each with a Task Kind), Chores (star value, frequency, icon, assigned children), Topics (star value, icon, the children they're switched on for) and the per-child, per-topic Level.
   - Answers: *what can this child print right now?* This takes into account per-child assignment, chores already approved in the current frequency period, and the one-open-ticket-per-category rule.
   - Task Kinds sit behind a single interface, so that adding a third kind later means adding one implementation rather than editing every module. Chore and Quiz are the two implementations. The interface covers:
     - what a child can choose
     - how a ticket's code and content are produced
     - what a hand-in counts towards

3. **Quiz content**
   - Owns Quiz Pools: one per child, per topic, per level. Each quiz holds its printable content and its answer key.
   - When a quiz is taken from an empty pool, a quiz the child has done before in that topic is reused and an alert is raised.
   - It raises a "pool low" alert when a pool falls below a threshold.
   - New quizzes come in through a **quiz source** port. In v1 the source supplies built-in sample quizzes. Later, the quiz-making agent tops up pools through the same port.

4. **Tickets**
   - Owns the ticket lifecycle: **Open** → **Handed In** → **Approved**, or **Dismissed**. A Rejection moves a ticket from Handed In back to Open. Approved and Dismissed are final.
   - A grown-up can approve or dismiss from Open or Handed In.
   - Enforces at most one open ticket per child per category.
   - **Chore codes** are stable for each child and chore (ADR 0001). A hand-in of a chore code applies to that child's current open ticket for that chore, if there is one.
   - **Quiz codes** are unique per ticket.
   - Codes are opaque, unguessable tokens, never sequential IDs, and they only resolve within their own chart.
   - Scan results are one of: *handed in*, *already handed in (waiting for a grown-up)*, *nothing to hand in (already done)*, or *not recognised*.
   - Owns Reprint Requests. A reprint happens only after a grown-up or guest approves it, and reproduces the same code and content.
   - Records who did each action (which grown-up, or "a guest").
   - Uses the Clock port and the chart's time zone for frequency periods, with days starting at midnight local time.

5. **Stars**
   - An append-only record of every star movement for each child: earnings from approvals and spending from Redemptions.
   - The **Balance** is always computed from this record (earned minus spent). The **Constellation** is this record over time.
   - A redemption that would take the balance below zero is refused.

6. **Observatories and devices**
   - Owns observatories, their parts (Screen, Printer, Scanner) and how parts are paired.
   - Pairing:
     - A new chart's first observatory is paired when its creator signs in on it.
     - Further observatories, and their parts, are paired by an owner or admin.
     - Fake parts pair by entering a pairing code.
     - How a real Printer pairs is an open question (see Further Notes).
   - Every part gets its own revocable device credential, never a grown-up's login.
   - Every part connects **outward** to the server and holds a live connection (ADR 0003). The Printer receives print jobs, and the Scanner sends scanned codes. The server works out which observatory screen should show the result.
   - The server tracks whether each part is online. If a needed part is offline, the action fails with a reason the screen can display (for example, "printer offline"), and no ticket is created. Nothing is queued for later.

7. **Notifications**
   - Sends web push to the devices each grown-up has subscribed, through a **push outbox** port.
   - Triggers:
     - hand-ins, grouped over a short window
     - Reprint Requests
     - pool low and recycled-quiz alerts
     - the Daily Summary at 7pm in each chart's time zone
   - Email (invitations and password resets) goes through an **email outbox** port. In development, emails are caught locally rather than sent.

8. **Clock**: a port that provides the current time. The real clock is used in production, and a controllable one in tests.

### Front ends

- **Observatory screen**: kiosk-mode web pages over the observatory part of the API. It is deliberately plain (see Project conventions in `CLAUDE.md`). The flow is: pick a child → balance and Constellation → categories → topic or chore choice → print, plus scan feedback states. It switches into the Control Center behind a Grown-up PIN or Guest PIN, and drops back to the children's view after a short idle period.
- **Control Center**: an installable PWA with web push. It is the same app on the observatory (behind a PIN) and on a phone. A phone gets there by scanning a single-use, short-lived QR code from the observatory, or by signing in on the web.
- **Fake Printer**: a small web page that pairs as a printer part and shows each print job as an image of a receipt-width ticket, including the QR code.
- **Fake Scanner**: a small web page that pairs as a scanner part and sends a typed or pasted code.

### Ticket printing

- Each print job describes the ticket's content: the child's nickname, the icon or text depending on the child's display style, the QR code, and the quiz content if it's a quiz. It is not tied to any particular printer's format.
- Everything printed must be black and white only, with no greys, because thermal printers can't print greys.

### Deleting data

- Deleting a child permanently deletes their tickets, star record and pool.
- Deleting a chart permanently deletes everything in it.
- Removing a grown-up deletes their login. Their past actions remain attributed to "a former grown-up".
- Nothing about children is merely hidden; it is removed.

## Testing Decisions

- **There is one seam: the server's public API**, which is HTTP plus the live device connections. Tests act as real clients would:
  - a fake observatory screen choosing a child and printing
  - a fake Printer receiving the print job
  - a fake Scanner sending a code
  - a grown-up, guest or admin client calling Control Center endpoints

  Tests then check outcomes through the same API, such as ticket states, balances, the Constellation and scan results.
- **Real pieces in tests:** Postgres (in Docker), migrations, every domain module, authentication, and device pairing and connections.
- **Fakes, only at the edges:** Clock, email outbox, push outbox and quiz source. Tests control time to cover midnight rollovers in different time zones, frequency periods, Guest PIN expiry, grouping of hand-in notifications and the 7pm Daily Summary. Tests read the outboxes to check emails and notifications.
- **What makes a good test:** it describes behaviour a person would recognise, for example "Nova can't print a second Math quiz while one is open", or "a chore approved today is unavailable until midnight in the chart's time zone". It never asserts on internal tables, module internals or how something is implemented, so modules can be restructured freely.
- **Areas that need thorough coverage:**
  - role and guest permissions, including that every action is refused across charts
  - the ticket lifecycle, including every transition and every scan result
  - the one-open-ticket-per-category rule
  - stable chore codes
  - frequency and time zones
  - balances never going negative
  - pool recycling
  - an offline part refusing to print
- **UI is not unit-tested**, because the screens are thin and will be redesigned. One browser smoke test checks that the observatory screen loads, a child can be chosen, and a tap produces a print job on the fake Printer.
- **Prior art:** none yet, because the repo is empty. The first tests set the pattern for later ones.

## Out of Scope

- Real hardware: printer drivers, a camera or QR scanner, ESP32 firmware, the Android picture frame setup, enclosures. The fake Printer and fake Scanner stand in.
- Parts connecting to each other locally, with only one connection to the server per observatory (the long-term aim in ADR 0003).
- How a real Printer pairs to an observatory.
- The visual and interaction design of the observatory screen. This is a later, dedicated design phase led by the project owner.
- The quiz-making agent. v1 provides only the quiz source port and sample quizzes.
- Showing answers during approval in a faster way than displaying the answer key alongside the quiz.
- Uploaded photos as icons, and dithering them for thermal printing.
- A reward catalog that children browse.
- Passkeys and magic-link sign-in.
- A native iOS app.
- The **Operator** console, billing, public marketing or sign-up pages, and scaling for a hosted service.
- Additional Task Kinds beyond Chore and Quiz. The interface allows for them, but none are built.

## Further Notes

- **Open question: how a real Printer pairs.** A printer can't scan, so the pairing-code approach for fake parts won't work. One idea is for the Printer to print a pairing code that the Scanner then reads. Decide when real hardware is chosen.
- **Proposed default to confirm: data deletion.** The rules under "Deleting data" are a proposed default. They should be reviewed before Star Chart serves anyone outside our household, along with a proper look at COPPA and FERPA.
- **Defaults chosen for v1, easy to change:**
  - Guest PINs last 12 hours.
  - Chores default to once per day.
  - Days start at midnight in the chart's time zone.
  - The Daily Summary arrives at 7pm.
  - The pool-low threshold and the hand-in grouping window are server settings.
- **The observatory screen's look comes later.** Its plain look in v1 is deliberate. Every observatory action should be available through the API, so that the design phase can rebuild the screens without touching the server.
- **Sample content:** sample quizzes for Spelling, Math (Addition, Subtraction) and Letters & Numbers, plus a starter set of chore icons, so that the system is usable on day one for Nova (words) and Pip (pictures).
