# 03: The Dome

**What to build:** The real children's Observatory becomes design A ("The Dome"), using the art from 02 and the existing observatory actions:
- Who are you: each child is a planet with their mascot on it.
- Their screen:
  - a dome holds the **Star Jar** (fill = **Balance**, size from lifetime stars) and a bare **Mascot**;
  - their **Task Categories** and tasks in no category float as big planets;
  - a dock of icon buttons sits at the bottom.
- Printing and scanning get their celebrations.

Same layout for every child; only words versus pictures differs.

**Blocked by:** 02 (Art folder and Art Gallery)

**Status:** ready-for-agent

- [ ] The child's observatory view includes `earned`, lifetime stars earned, which never drops when stars are spent (API test).
- [ ] Who are you shows every child as a big planet with their mascot, and Nova's nickname. A small, unobtrusive corner button opens the grown-up PIN into the Control Center, as before.
- [ ] The dome shows the star jar filled to the balance and the mascot.
  - Jar capacity is the first of 10, 25, 50, 100, 200 above lifetime earned, otherwise 500.
  - Spending never shrinks the jar.
  - Children who see words get the number under the jar.
- [ ] Categories and tasks in no category show as planets: icons for pictures, names and star values for words. Tasks done for now are faded and not tappable. A category opens its own planets, and Back returns.
- [ ] Tapping a task prints it: the ticket slides out with confetti. Print refusals show a friendly message: already have one of that kind out, printer offline, done for now.
- [ ] Scan outcomes from the live connection get big celebrations or messages: handed in ("Great job! A grown-up will check it."), already done, waiting for a grown-up. Reprint requests still work.
- [ ] The dock has big icon buttons, with words for children who see words. Back and the PIN button work now. Store, Sticker Book and My sky appear as their tickets land.
- [ ] An 800×1280 portrait stage, scaled to fit, built for Chrome 101. Animations use only transform and opacity, and there are no unsupported CSS features or emoji.
- [ ] The smoke test drives it at 800×1280: pick a child, print a task, scan it, see the celebration.
- [ ] CLAUDE.md's "keep the observatory screen plain until its design phase" is replaced by "the observatory follows The Dome (variant A); see `.scratch/observatory-design/verdict.md`".
