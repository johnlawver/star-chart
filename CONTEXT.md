# Star Chart

A reward system for households and classrooms. Children choose tasks at an **observatory**, which prints them as **tickets**. They do the task, scan the ticket to hand it in, and earn **stars** once a **grown-up** approves it.

This file is the project's glossary: one canonical word for each concept. Decisions and the reasons behind them live in `docs/adr/`.

## Language

### The product

**Star Chart**:
The product and service as a whole.
_Avoid_: Using it for a single device or a single group; those are an observatory and a chart.

### People and groups

**Chart**:
The top-level group that everything belongs to: one household or one classroom, with its own grown-ups, children, tasks and stars. Every grown-up and every child belongs to exactly one chart. Each chart has a time zone, and anything to do with days or times of day, such as frequencies and the daily summary, follows it.
_Avoid_: Household, class, account, workspace, group, family

**Grown-up**:
An adult with their own login in a chart, such as a parent or teacher, who sets up tasks and confirms that children have completed them. Every grown-up can run the chart day to day; only admins and the owner manage the people and the observatories.
_Avoid_: Parent, teacher, user, member

**Owner**:
The one grown-up in charge of a chart, who starts as whoever created it. Only the owner can promote, demote and remove admins or delete the chart. The owner can hand ownership to an admin, and must do so before leaving, so a chart always has an owner.
_Avoid_: Super admin, creator, root

**Admin**:
A grown-up the owner has promoted. On top of what every grown-up can do, an admin can invite and remove other grown-ups and pair or unpair observatories, but cannot manage admins, transfer ownership or delete the chart.
_Avoid_: Superuser, manager, moderator

**Invitation**:
An email from an admin or the owner asking someone to join a chart as a grown-up. Accepting it creates their login; no observatory is needed.
_Avoid_: Invite link, sign-up link

**Guest**:
Someone with no login, such as a babysitter, who uses a guest PIN to handle tickets at an observatory for a limited time: approving, rejecting and dismissing them, and approving reprint requests. Anything a guest does is recorded as done by a guest.
_Avoid_: Babysitter, temporary user, visitor

**Child**:
A member of a chart who does tasks and earns stars. A child is known only by a nickname, and has no login and no other personal details.
_Avoid_: Kid, student, user, player

**Display Style**:
Whether a child sees tasks as pictures or as words, both on the observatory and on printed tickets. It is set per child by a grown-up.
_Avoid_: Version, mode, reading level

**Operator**:
Someone who runs the Star Chart service itself and supports charts from outside them, for example by transferring ownership of a chart whose owner is gone. Planned for later, not part of any chart.
_Avoid_: Administrator, support admin, staff

### Tasks

**Task**:
Anything a child can do to earn stars: either a chore or a quiz.
_Avoid_: Job, activity, assignment

**Task Category**:
A top-level button a child taps at the observatory, such as Chores, Math, Spelling or Letters & Numbers. Grown-ups can add new categories at any time. A child sees a category only if it holds at least one chore or topic switched on for them, and may hold at most one open ticket per category.
_Avoid_: Group, task type, activity

**Task Kind**:
How the tasks in a category behave: as chores or as quizzes. A grown-up picks the kind when creating a category. More kinds may be added later.
_Avoid_: Task type, mode

**Chore**:
A task that is reused over and over, such as "Make your bed", with its own star value. Grown-ups assign each chore to particular children. A child's ticket for a chore always carries the same QR code, so a lost or old ticket can be reprinted or reused.
_Avoid_: Job, duty

**Frequency**:
How often a chore can earn stars: a number of times per day or per week, such as once a day or twice a day. It is set when a grown-up adds the chore, and is once a day unless they choose otherwise. Days start at midnight and weeks on Monday, in the chart's time zone.
_Avoid_: Cooldown, schedule, repeat

**Topic**:
A subject within a quiz category, such as Addition or Subtraction within Math. It decides which quiz pool a quiz comes from and how many stars it is worth. Grown-ups switch topics on for each child. If a child has only one topic switched on in a category, tapping the category prints straight away; otherwise the child taps the category, then picks a topic.
_Avoid_: Type, quiz type, subject, subcategory

**Quiz**:
A one-off task with its own printed content, such as math problems, spelling words, or letters and numbers to identify. It comes from a topic's quiz pool, and each quiz ticket is unique.
_Avoid_: Challenge, test, worksheet

**Icon**:
The picture for a chore, topic or category, shown to children whose display style is pictures. It is chosen from a built-in library and printed in black and white.
_Avoid_: Image, picture, emoji, graphic

### Quiz content

**Level**:
How hard a child's quizzes are in one topic. It is set per child, per topic.
_Avoid_: Grade, difficulty, tier

**Quiz Pool**:
The ready-made quizzes waiting to be printed for one child, in one topic, at their current level. Each quiz in the pool carries its answer key. The quiz feed keeps each pool topped up to the chart's target size. If the pool runs empty, a quiz the child has done before in that topic is printed again on a new ticket, and grown-ups are alerted.
_Avoid_: Queue, bank, backlog

**Quiz Item**:
One question in a quiz: a prompt (such as "7 + 5" or "Spell: because") and its answer.
_Avoid_: Question, problem, exercise

**Score**:
How many of a quiz's items a child got right, which a grown-up may record when approving it.
_Avoid_: Mark, grade, result

**Quiz Feed**:
An outside service that fills a chart's quiz pools and reads how finished quizzes went, so it can pitch the next ones at the right level. It knows children only by an id, never by nickname.
_Avoid_: Generator, agent, quiz source, AI

**Feed Key**:
The credential an admin creates so a quiz feed can reach one chart's quiz pools. It can be revoked at any time.
_Avoid_: API key, token, secret

### Tickets

**Ticket**:
A printed slip that puts a task in a child's hands, identified by the QR code printed on it.
_Avoid_: Receipt, slip, printout, card

**Ticket States**:
Every ticket is in exactly one state:
- **Open**: printed and not yet handed in.
- **Handed In**: waiting for a grown-up.
- **Approved**: stars awarded. This is final.
- **Dismissed**: closed with no stars. This is final.

A rejection moves a ticket from Handed In back to Open.
_Avoid_: Pending, done, complete, closed, cancelled

**Hand-in**:
A child scanning a ticket's QR code to say the task is done. The ticket then waits for a grown-up's approval or rejection.
_Avoid_: Check-in, submit, complete

**Approval**:
A grown-up's confirmation that a ticket's task was done, which awards its stars to the child. A grown-up can approve a ticket that is open or handed in, so a hand-in isn't required. The grown-up may override the star value when approving.
_Avoid_: Ack, sign-off, verification

**Rejection**:
A grown-up's decision that a handed-in ticket isn't done yet. The ticket goes back to open, with an optional note, and earns no stars.
_Avoid_: Decline, deny

**Dismissal**:
A grown-up closing an open or handed-in ticket without stars, for example because it was lost, is too hard, or the chore was already done by someone else.
_Avoid_: Cancel, delete, void

**Reprint Request**:
A child asking from the observatory for a lost ticket to be printed again. It prints only after a grown-up approves it.
_Avoid_: Reprint, replacement

### Stars

**Star**:
The unit of reward a child earns for completing a task.
_Avoid_: Point, credit, token

**Balance**:
The stars a child currently has available to spend: everything earned minus everything spent. It never drops below zero, so a redemption can't be larger than the balance.
_Avoid_: Score, total, wallet

**Redemption**:
A grown-up recording that a child spent stars, with an amount and a note such as "ice cream".
_Avoid_: Purchase, withdrawal, spend

**Constellation**:
A child's complete star history: every star earned and every redemption, over time.
_Avoid_: History, ledger, star history, log

### Places and devices

**Observatory**:
The unit that children use: a screen, a printer and a scanner working together. A brand-new chart's first observatory is paired when its creator signs in on it; that person becomes the chart's owner. After that, only admins and the owner can pair more observatories. An observatory stays signed in once paired. A chart can have any number of observatories, and they all show the same children. A child first picks themselves, then sees their own balance and chooses a task category to print.
_Avoid_: Kiosk, station, device, star chart, kid app

**Screen**:
The observatory's touchscreen, which shows children their view and, behind a grown-up PIN or guest PIN, the control center.
_Avoid_: Display, tablet, frame

**Printer**:
The part of an observatory that prints tickets.
_Avoid_: Print server, receipt printer

**Scanner**:
The part of an observatory that reads a ticket's QR code for a hand-in, whether it is a camera or a barcode reader.
_Avoid_: Camera, reader, code reader

**Control Center**:
The grown-up side of Star Chart, used to manage the chart and confirm completed tickets. It opens on an observatory's screen behind a PIN. A grown-up can install it on their phone by scanning a QR code shown there, or by signing in on the web, for example after accepting an invitation.
_Avoid_: Grown-up app, parent app, admin app, admin panel, dashboard

**Daily Summary**:
A notification each evening at 7pm, in the chart's time zone, telling grown-ups what each child earned that day and which tickets are still open.
_Avoid_: Digest, report, recap

**Grown-up PIN**:
A grown-up's personal code for opening the control center on an observatory's screen, so children can't get in.
_Avoid_: Passcode, password, parent PIN

**Guest PIN**:
A short-lived, anonymous code that any grown-up can create so that a guest can open the control center on an observatory's screen. It expires after 12 hours unless the grown-up sets a different time, and a grown-up can cancel it early.
_Avoid_: Temporary PIN, babysitter code, guest pass
