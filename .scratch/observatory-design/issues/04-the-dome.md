# 04: The Dome

**What to build:** The real children's Observatory becomes design A ("The Dome"), using the art from 02 and the existing observatory actions:
- Who are you: each child is a planet with their mascot on it.
- Their screen:
  - a dome holds the **Star Jar** (fill = **Balance**, size from lifetime stars) and a bare **Mascot**;
  - their **Task Categories** and tasks in no category float as big planets;
  - a dock of icon buttons sits at the bottom.
- Printing and scanning get their celebrations.

Same layout for every child; only words versus pictures differs.

**Blocked by:** 02 (Art folder and Art Gallery), 03 (Ready for the frame)

**Status:** done (2026-11-24)

- [x] The child's observatory view includes `earned`, lifetime stars earned, which never drops when stars are spent (API test).
- [x] Who are you shows every child as a big planet with their mascot, and Nova's nickname. A small, unobtrusive corner button opens the grown-up PIN into the Control Center, as before.
- [x] The dome shows the star jar filled to the balance and the mascot.
  - Jar capacity is the first of 10, 25, 50, 100, 200 above lifetime earned, otherwise 500.
  - Spending never shrinks the jar.
  - Children who see words get the number under the jar.
- [x] Categories and tasks in no category show as planets: icons for pictures, names and star values for words. Tasks done for now are faded and not tappable. A category opens its own planets, and Back returns.
- [x] Tapping a task prints it: the ticket slides out with confetti. Print refusals show a friendly message: already have one of that kind out, printer offline, done for now.
- [x] Scan outcomes from the live connection get big celebrations or messages: handed in ("Great job! A grown-up will check it."), already done, waiting for a grown-up. Reprint requests still work.
- [x] The dock has big icon buttons, with words for children who see words. Back and the PIN button work now. Store, Sticker Book and My sky appear as their tickets land.
- [x] It's built on the turning, scaling 800×1280 stage from 03, and follows the frame rules there: animations that end, single taps only, no `confirm`/`alert`, no new windows.
- [x] After a minute with no taps, a child's screen goes back to Who are you.
- [x] The smoke test drives it at 800×1280: pick a child, print a task, scan it, see the celebration.
- [x] CLAUDE.md's "keep the observatory screen plain until its design phase" is replaced by "the observatory follows The Dome (variant A); see `.scratch/observatory-design/verdict.md`".

## Comments

2026-11-24: Done.
- **Server:** the child's view adds `earned`.
- **Screens:** `src/web/observatory/dome/` holds the screens (WhoAreYou, ChildScreen, Printing, CouldNotPrint, Scanned), the styles and `useIdle`. `main.tsx` keeps every action: pairing, PIN unlock, print, reprint, star history and the live connection.
- **Star history:** tapping the jar shows it (the old "My stars" button), with Back in the dock.
- **Jar:** a bigger jar is drawn slightly wider.
- **After a print:** the screen goes back to Who are you after 4 s, as before.
- **Dock:** only Back for now. Store, Sticker Book and My sky arrive with tickets 06 and 07.
- **Tests:** the smoke test covers the frame (`?turn=right`), a computer window and portrait, through to the scan celebration, plus the idle return (with Playwright's clock). Checked by breaking the idle timer.
