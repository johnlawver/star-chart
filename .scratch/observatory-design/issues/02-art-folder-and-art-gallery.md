# 02: Art folder and Art Gallery

**What to build:** Every picture and small animation the redesigned Observatory will use lives in one art folder, as files the project owner can replace one at a time. An **Art Gallery** page shows all of it in every state, like Storybook but for art, so changes can be reviewed at a glance, including on the real picture frame. The first art is the prototype's (variant A) drawings, redrawn as separate files.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] One art folder, with each image a plain SVG (or PNG) named by a stable id. It covers:
  - the mascot body and moods (happy, wow);
  - outfits: hats crown, wizard and helmet, and hair spiky and curly;
  - stickers: rocket, moon, planet, alien and comet;
  - jar art for each jar size, star, dock icons and planet backgrounds.
- [x] A manifest lists every art id, what it's for and its states. Code asks for art by id only. Store item ids map to art ids by convention (`stickers/<id>`, `outfits/<kind>-<id>`).
- [x] Replacing an image means swapping the file with the same name: no code change, and the build picks it up. A PNG is used when there's no SVG of that name.
- [x] The mascot, moods and outfits share one canvas size, so outfits stack on the body with no positions in code.
- [x] One animations module defines named transform-and-opacity animations, each with its timing in one place: fly-in, fly-out, confetti, twinkle, bounce, ticket-slide and pop.
- [x] `art-gallery.html` shows every manifest entry at real size on the observatory background. It includes:
  - the jar from empty to full at each size;
  - the mascot bare, in each outfit and in each mood;
  - each sticker;
  - each constellation empty, part-filled and full, using the built-in list of about 12 real constellations in fill order;
  - a replay button for every animation;
  - missing files flagged in red.
- [x] The Art Gallery is in development builds and left out of release builds (`STAR_CHART_RELEASE=true`). It runs on Chrome 101 and needs no new dependencies.
- [x] The smoke test loads the Art Gallery and confirms nothing is flagged missing.
- [x] The README says how to replace art and where the gallery is.

## Notes

- The art lives in `src/web/observatory/art/`:
  - `files/` holds 27 SVGs.
  - `files.ts` finds them with `import.meta.glob`, so art is looked up by id and an SVG wins over a PNG.
  - `manifest.ts` lists every entry with its purpose and canvas, plus `storeItemArt()` for the store-item naming convention and `jarSizes`.
  - `animations.ts` holds 8 named animations as `.anim-<name>` classes.
  - `constellations.ts` holds 12 constellations (77 stars) and `skyFor(earned)`. A full sky stays full until the next star starts the golden next round.
  - `components.tsx` has Art, Mascot, StarJar plus `jarCapacity`/`jarArt`, Constellation, Confetti, TwinklingSky and FlyingStars.
- A missing file shows a dashed placeholder, never a crash.
- The jar's inside is a CSS mask from `jar/inside.svg`. Its `url("…")` must be quoted, because Vite inlines small SVGs as data URLs. Stars sit only in the filled part, with an even "R2" scatter.
- A jar is never completely full: the star that would fill it moves the child up to the next size. The gallery shows "just spent", "half" and "nearly full" for each size.
- `art-gallery.html` is left out when `STAR_CHART_RELEASE=true`, which I checked with a release build. The smoke test checks that every expected id is shown, none is flagged missing, no image is broken and there are at least 12 constellations. Hiding `stickers/moon.svg` made it fail.
- Added `src/web/vite-env.d.ts` for Vite's client types.
