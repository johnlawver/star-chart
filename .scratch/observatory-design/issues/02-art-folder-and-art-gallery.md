# 02: Art folder and Art Gallery

**What to build:** Every picture and small animation the redesigned Observatory will use lives in one art folder, as files the project owner can replace one at a time. An **Art Gallery** page shows all of it in every state, like Storybook but for art, so changes can be reviewed at a glance, including on the real picture frame. The first art is the prototype's (variant A) drawings, redrawn as separate files.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] One art folder, with each image a plain SVG (or PNG) named by a stable id. It covers:
  - the mascot body and moods (happy, wow);
  - outfits: hats crown, wizard and helmet, and hair spiky and curly;
  - stickers: rocket, moon, planet, alien and comet;
  - jar art for each jar size, star, dock icons and planet backgrounds.
- [ ] A manifest lists every art id, what it's for and its states. Code asks for art by id only. Store item ids map to art ids by convention (`stickers/<id>`, `outfits/<kind>-<id>`).
- [ ] Replacing an image means swapping the file with the same name: no code change, and the build picks it up. A PNG is used when there's no SVG of that name.
- [ ] The mascot, moods and outfits share one canvas size, so outfits stack on the body with no positions in code.
- [ ] One animations module defines named transform-and-opacity animations, each with its timing in one place: fly-in, fly-out, confetti, twinkle, bounce, ticket-slide and pop.
- [ ] `art-gallery.html` shows every manifest entry at real size on the observatory background. It includes:
  - the jar from empty to full at each size;
  - the mascot bare, in each outfit and in each mood;
  - each sticker;
  - each constellation empty, part-filled and full, using the built-in list of about 12 real constellations in fill order;
  - a replay button for every animation;
  - missing files flagged in red.
- [ ] The Art Gallery is in development builds and left out of release builds (`STAR_CHART_RELEASE=true`). It runs on Chrome 101 and needs no new dependencies.
- [ ] The smoke test loads the Art Gallery and confirms nothing is flagged missing.
- [ ] The README says how to replace art and where the gallery is.
