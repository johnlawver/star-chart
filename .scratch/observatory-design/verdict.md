# Observatory design: prototype verdict

**Question:** What should the children's view of the Observatory look and feel like, so Nova (6, words) and Pip (3, pictures) want to come back and do more chores?

**Prototype:** branch `prototype/observatory-design` (commit `006a52b`, plus Control Center links in `f64c0bb`). Three variants at 800×1280 portrait, switchable with `?variant=A|B|C`:

- **A, "The Dome":** a dome holding the star jar and mascot, tasks as big planets, an icon dock (Back, Store, Stickers, My sky).
- B, "Rocket Toybox": a fuel tank, bricks, a gumball store and a paged star map.
- C, "Star Path": a winding path, a market stall, a scrolling sky and tabs at the top.

**Verdict (2026-10-24):** A is the strong winner, chosen by the family after the children tried all three.

**Next:** fold A into the real Observatory on `main`, rewritten rather than copied. Open questions are in the follow-up spec.
