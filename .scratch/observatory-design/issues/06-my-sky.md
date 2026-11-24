# 06: My sky

**What to build:** A "My sky" button on the dock opens the child's sky, where every star they've ever earned fills real **Constellations** one star at a time, in order. Finished constellations stay finished, even after spending. Past the last constellation, a second golden round begins, so the sky never runs out.

**Blocked by:** 04 (The Dome)

**Status:** done (2026-11-24)

- [x] My sky uses the built-in ordered constellations from the art folder and the child's lifetime `earned`.
- [x] Each constellation shows filled and empty stars. Children who see words get its name and progress ("4 / 7"), or a tick when it's finished.
- [x] Finished constellations sparkle once when My sky opens, not forever (frame rule).
- [x] Spending stars never empties a constellation, because it's based on lifetime earned.
- [x] Earning more than the whole sky holds starts a golden second round.
- [x] The smoke test opens My sky.

## Comments

2026-11-24: Done. The dock gains My sky, using the `dock/sky` art. The sky panel shows all 12 constellations from lifetime `earned` (`skyFor`), with the name and "n / m" or a tick for words. Finished ones sparkle once each, staggered, and `Constellation` no longer animates every star itself, to keep the number of simultaneous animations low on the frame. Later rounds are drawn in gold with "Golden sky, round N!". The smoke test opens My sky with 2 stars earned: Cassiopeia shows 2 of 5 and the other 11 are empty.
