# 09: Icons and Display Style

**What to build:** A built-in library of bold, black-and-white **Icons**. Grown-ups choose an icon for each category and chore (and later topics). Children whose Display Style is pictures see big icons on their Observatory buttons and on printed tickets. Children set to words see text.

**Blocked by:** 04 (Print a chore ticket)

**Status:** done

- [x] A built-in icon library ships with the app, including a starter set suitable for common chores.
- [x] Grown-ups pick an icon when creating or editing a category or chore.
- [x] A child set to pictures sees icons on the Observatory and a large icon on printed tickets. A child set to words sees text.
- [x] Everything sent to a Printer is pure black and white, with no greys.

## Notes

- The library is a curated set of 36 Tabler Icons (MIT), listed with grown-up-friendly labels in `src/server/icons/icons.ts`. Each is redrawn in solid black (`#000`) with a heavier stroke, because thermal printers print only black and thin lines come out faint. A test checks that every icon uses no colour but black.
- Icons are stored by id on categories, chores and tickets (so a reprint shows exactly what was printed). Unknown ids are refused.
- Display style is applied by whoever draws: the observatory shows big icon buttons for a pictures child (names kept for screen readers), and the fake printer prints the icon large instead of the title. Both are deliberately plain until the observatory's design phase.
- Topics will get icons in ticket 10, which the library already supports.
- Uploaded photos (and dithering them) remain out of scope.
