# Spec: The Dome (the children's Observatory, designed)

Status: ready-for-agent

Terms in **bold** are defined in `CONTEXT.md`. The design question and its verdict are in `verdict.md` next to this file. The prototype is the primary source for the look, on branch `prototype/observatory-design` as variant A. Standing rules are in the "Project conventions" section of `CLAUDE.md`.

## Problem Statement

The children's side of the **Observatory** works, but it was deliberately kept plain until a design phase: a list of buttons, a number for the **Balance**, and a "My stars" list. It doesn't make Nova (6) or Pip (3) want to come back.

We ran that design phase. We prototyped three directions, and the family (both kids included) picked variant A, "The Dome", by a clear margin. We now need A built properly into the real Observatory. We also need the things A promised that don't exist yet: stars pouring into a jar since your last visit, a sky of constellations that fills up over time, a store where stars buy stickers and outfits, a sticker book, and a mascot that wears what you bought.

## Solution

The children's Observatory becomes The Dome, as in prototype A:

- **Who are you?** Each child is a big planet with their mascot on it. Tap yours.
- **Your screen:**
  - The top half is an observatory dome holding your **Star Jar** and your **Mascot**.
  - Below the dome, your **Task Categories** and the tasks in no category float as big planets. Tap one to print, or tap a category to see its tasks.
  - At the bottom is a dock of icon buttons: Back, **Store**, **Sticker Book**, and My sky.
  - Nova sees words with the icons; Pip sees pictures only. The layout is the same for both.
- **New stars:** stars approved since your last visit fly into the jar one by one, with "You earned 3 stars!" (or just the stars, for pictures).
- **The jar:** it fills to show your Balance. It grows into a bigger jar as your lifetime stars grow, and spending never shrinks it.
- **Printing and scanning:** a ticket slides out with confetti when one prints. "Great job! A grown-up will check it." appears when you scan it in. The existing outcomes ("already done", "waiting for a grown-up") get the same treatment.
- **Store:** buy a sticker, a hat or a hairstyle with your stars. Stars fly out of the jar, and the purchase shows in your **Star History** for grown-ups. Each item can be bought once.
- **Sticker Book:** every sticker you've bought, stuck on a page.
- **Mascot:** your own Comet wears the hat and hair you choose from what you've bought, everywhere it appears.
- **My sky:** every star you've ever earned fills real **Constellations** (Cassiopeia, Cygnus, the Little Dipper and so on) one star at a time. Finished ones stay finished.

The store comes with a built-in set of items and prices. For now, an admin adds more of the predefined items through an API endpoint, with no Control Center screen.

## User Stories

### Who are you

1. As a child, I want to find myself by my mascot on a big planet, so that I can start without reading.
2. As Nova, I want to see my nickname on my planet, so that I'm sure it's mine.
3. As a grown-up, I want the observatory to keep showing every child in the chart, in the same order as before, so that nothing about who appears changes.

### My screen

4. As a child, I want my star jar and my mascot at the top of my screen, so that the first thing I see is what I've earned.
5. As a child, I want the jar to look as full as my balance, so that I can tell how many stars I have without counting.
6. As Nova, I want my balance as a number under the jar, so that I know exactly how many stars I have.
7. As a child, I want my jar to grow into a bigger jar as I earn more stars over time, so that I feel I'm going somewhere.
8. As a child, I want my jar never to shrink when I spend stars, so that buying something doesn't feel like losing.
9. As a child, I want my task categories and the tasks in no category as big tappable planets, so that choosing what to do is easy and fun.
10. As Pip, I want each planet to show its icon rather than words, so that I can choose without reading.
11. As Nova, I want each planet to show its name, and each task its star value, so that I can choose what's worth the most.
12. As a child, I want tasks I've already done for now to look faded and not respond, so that I know to pick something else.
13. As a child, I want to tap a category and see its tasks as planets, then come back with the Back button, so that I'm never stuck.
14. As a child, I want the dock buttons (Back, Store, Sticker Book, My sky) as big icons, so that I can get around without reading.
15. As Nova, I want short words on the dock buttons too, so that I'm sure what each does.
16. As a grown-up, I want the screen to work the same way for every child and to differ only in words versus pictures, so that one child can help another.

### New stars since my last visit

17. As a child, I want stars approved since my last visit to fly into my jar one by one when I open my screen, so that I feel rewarded for what I did.
18. As Nova, I want "You earned 3 stars!" while they fly in, so that I know how many arrived.
19. As a child, I want stars to arrive only once, even if I go back and open my screen again, so that the moment means something.
20. As a child with two observatories, I want my new stars to arrive wherever I look first, and not again on the other one, so that it feels like one me.
21. As a child, I want my screen to work straight away when no stars have arrived, so that I'm not kept waiting.
22. As a child, I want to be able to tap through the animation if I'm in a hurry, so that it never blocks me.

### Printing and scanning

23. As a child, I want a ticket to slide out with confetti when I tap a task, so that printing feels exciting.
24. As a child, I want the screen to tell me (or show Pip) when my ticket couldn't print, for example because I already have a chore out or the printer is offline, so that I know what to do.
25. As a child, I want a big "Great job!" celebration when I scan my ticket in, so that handing in feels good.
26. As a child, I want a friendly "Already done!" or "Waiting for a grown-up" when I scan a ticket that's finished or already in, so that I'm not confused.
27. As a child, I want to ask for a lost ticket to be printed again from my screen, as today, so that losing one isn't a disaster.

### Store

28. As a child, I want a store behind a dock button, where I see stickers, hats and hairstyles with their prices in stars, so that I have something to save up for.
29. As Pip, I want prices shown as a number with a star, and items shown as pictures, so that I can shop without reading.
30. As a child, I want items I can't afford yet to look unaffordable, so that I know to save.
31. As a child, I want stars to fly out of my jar when I buy something, so that spending feels real.
32. As a child, I want my balance and jar to update right away after buying, so that I see what's left.
33. As a child, I want an item I already own to show as mine and not be buyable again, so that I don't waste stars.
34. As a child, I want two quick taps not to buy the same thing twice or spend more stars than I have, so that mistakes don't cost me.
35. As a grown-up, I want store purchases to show in the child's star history in the Control Center, as "Bought: Crown, 6 stars", so that I can see where stars went.
36. As a grown-up, I want store purchases to spend the same balance as redemptions, with no approval step, so that there's one balance and no extra work for me.
37. As a grown-up, I want a store purchase never to take a balance below zero, so that the rule for redemptions also holds here.
38. As a grown-up, I want the store to start with a sensible set of items and prices, so that it works without setup.

### Adding store items

39. As an admin, I want an API endpoint that adds another item from the built-in list to our chart's store, optionally at a different price, so that I can freshen the store before there's a screen for it.
40. As an admin, I want to be refused when I add an item that isn't in the built-in list, or one already in our store, so that the store stays sensible.
41. As a grown-up who isn't an admin, or a guest, I want to be refused when adding store items, so that only admins shape the store.
42. As a grown-up, I want one chart's store and purchases never to show up in another chart, so that charts stay apart.

### Sticker Book

43. As a child, I want a sticker book behind a dock button that shows every sticker I've bought, so that I can admire my collection.
44. As a child with no stickers yet, I want a friendly empty page pointing me to the store, so that I know how to get some.

### Mascot

45. As a child, I want my own mascot, so that the observatory feels like mine.
46. As a child, I want to put on a hat or hairstyle I've bought, and take it off again, so that I can dress my mascot how I like.
47. As a child, I want to wear at most one hat and one hairstyle at a time, so that my mascot looks right.
48. As a child, I want my mascot to wear my choice everywhere it appears (who-are-you, my dome, the store) and on any observatory, so that it's really mine.
49. As a child, I want to be refused when I try to wear something I don't own, so that the store matters. (This guards against a tampered screen; the screen only offers what you own.)

### My sky

50. As a child, I want a "My sky" screen where every star I've ever earned fills real constellations one star at a time, so that I see my progress over weeks and months.
51. As a child, I want finished constellations to stay finished, even after I spend stars, so that my sky only ever grows.
52. As Nova, I want each constellation's name and how many of its stars I've filled, so that I know how close the next one is.
53. As a child who has earned more stars than the whole sky holds, I want my sky to keep going, so that I never run out.

### Replacing the art

54. As the project owner, I want every picture on the observatory (mascot, outfits, stickers, jar, planets, constellations, dock icons) to be a separate file I can swap, so that I can improve the art bit by bit as we find the direction.
55. As the project owner, I want to replace an image by dropping in a new SVG or PNG with the same name, with no code change, so that updating art is quick and safe.
56. As the project owner, I want outfits drawn to line up with the mascot in a shared frame, so that a new hat sits on the head without fiddling with positions in code.
57. As the project owner, I want each small animation (stars flying, confetti, twinkle, bounce, ticket slide) defined in one place with its timing, so that I can tune or replace one without touching the screens.
58. As the project owner, I want an Art Gallery page, like Storybook but for art, that shows every image and animation in all its states (empty to full jar, mascot in each outfit, each sticker, each constellation partly and fully filled, each animation replayable), so that I can review changes at a glance.
59. As the project owner, I want to open the Art Gallery on the real picture frame and my phone, so that I can judge size and smoothness on the hardware itself.
60. As the project owner, I want the Art Gallery to flag an item whose file is missing, so that a replacement never silently breaks the observatory.

### Living on the frame

61. As a child, I want the observatory to be working when I walk up to it, even after a power cut or the server restarting, so that I never find a broken screen.
62. As a child, I want my screen to go back to Who are you if I wander off, so that my brother doesn't land on my screen.
63. As a grown-up, I want the observatory to fill the frame upright whichever way it reports itself, and to match how we hung it, so that nothing is sideways.
64. As a grown-up, I want new versions of the observatory to show up on the frame by themselves, so that I never have to climb up and reload it.
65. As a grown-up, I want the Control Center's "are you sure?" questions to work on the frame as they do on my phone, so that I can manage things there.

### Grown-ups and the screen

66. As a grown-up, I want the Control Center on the observatory to open behind my PIN exactly as before, so that the redesign changes nothing for grown-ups.
67. As a grown-up, I want the redesigned screen to run on our Android 6 picture frame (WebView 106) and to keep its animations light, so that it works on the hardware we have.

## Implementation Decisions

### Domain and glossary

- New and changed terms are in `CONTEXT.md`: **Star Jar**, **Star History**, **Constellation** (redefined), **Store**, **Store Item**, **Purchase**, **Sticker**, **Sticker Book**, **Mascot**, **Outfit**, and **New Stars**.
- **Constellation** used to mean the earned-and-spent record. It now means a real star pattern that a child's lifetime stars fill. The record is the **Star History**, and the constellation endpoints and code are renamed to match (`/api/children/:id/star-history` and the observatory equivalent). Only our own front ends call them, so they're renamed in one go rather than kept alongside the old names.
- A **Purchase** is a child spending stars on a store item at the observatory. A **Redemption** is still a grown-up recording real-world spending. Both are star movements against one Balance.
- The CLAUDE.md convention "keep the observatory screen plain until its design phase" is replaced by "the observatory follows The Dome (variant A); see the verdict".

### Server modules

**Stars**
- The child's observatory view gains:
  - `earned`: lifetime stars earned. It only ever grows, because movements are append-only and approvals are final.
  - `newStars`: stars earned since the child's last visit.
- The Star History gains purchase entries: kind `spent`, what `Bought: <item name>`.
- Purchases and redemptions share the balance check and the row lock on the child, so concurrent spends can't overspend. Prior art: the ten-parallel-redemptions test.

**Visits**
- Each child has a last-visit time, stored with the child. It isn't personal data; it's when they last opened their screen.
- `POST /api/observatory/children/:childId/visit` records "now" as the last visit. The screen calls it once the new stars have landed.
- `newStars` = stars earned (approvals) after the last visit. It ignores spending: buying something isn't "new stars".
- A child who has never visited counts from when they were added, so the first visit doesn't pour a lifetime of stars.

**Store (new module)**
- **The built-in list** lives in code: each predefined item has an id, a kind (`sticker`, `hat` or `hair`), a name, a default price, and whether it's in the starting store. Artwork is on the front end, keyed by item id. From the prototype:

  ```ts
  // Starting store (the prototype's items and prices); the built-in list holds more than this.
  { kind: "sticker", id: "rocket", name: "Rocket", price: 2 },
  { kind: "sticker", id: "moon", name: "Moon", price: 2 },
  { kind: "sticker", id: "planet", name: "Ringed planet", price: 3 },
  { kind: "sticker", id: "alien", name: "Friendly alien", price: 4 },
  { kind: "sticker", id: "comet", name: "Comet", price: 3 },
  { kind: "hat", id: "crown", name: "Crown", price: 6 },
  { kind: "hat", id: "wizard", name: "Wizard hat", price: 5 },
  { kind: "hat", id: "helmet", name: "Space helmet", price: 8 },
  { kind: "hair", id: "spiky", name: "Spiky hair", price: 4 },
  { kind: "hair", id: "curly", name: "Curly hair", price: 4 },
  ```

- **A chart's store:** rows of (chart, built-in item id, price, seq). New charts get the starting store when created. A migration gives existing charts the starting store.
- **Endpoints:**
  - `GET /api/observatory/store` (screen): the chart's store items in order.
  - `POST /api/observatory/children/:childId/purchases {storeItemId}` (screen):
    - 201 returns the new balance and the child's wardrobe;
    - 409 "not enough stars" returns the balance;
    - 409 "already owned";
    - 404 not found or not yours.
  - `POST /api/store-items {itemId, price?}` (owner or admin):
    - 201 adds a built-in item to the store;
    - 400 for an id not in the built-in list;
    - 409 if it's already in the store.
    - Grown-ups and guests get 403.
- **Purchases:** a purchases table (chart, child, store item, price paid, when) and a negative star movement linked to it, in the same transaction. A unique (child, store item) index backs "each item once".

**Mascot**
- The child's observatory view and the purchase response include the wardrobe: `{ owned: itemId[], wearing: { hat: itemId | null, hair: itemId | null } }`. Stickers are the owned items of kind `sticker`.
- `PUT /api/observatory/children/:childId/mascot {hat, hair}` (screen), where each is an owned item id of the right kind, or null:
  - 200 returns the wardrobe;
  - 409 for an item not owned or of the wrong kind;
  - 404 not found or not yours.
- Wearing is stored per child, so every observatory shows the same mascot.
- The who-are-you list (`GET /api/observatory/children`) includes each child's `wearing`, so their planet shows their mascot dressed.

### Art (replaceable assets)

- **One art folder** for the observatory. Each image is a plain SVG or PNG file named by a stable id, for example:
  - `stickers/rocket.svg`, `outfits/hat-crown.svg`, `mascot/body.svg`;
  - `jar/small.svg`;
  - `dock/store.svg`, `planets/1.svg`.
- **One manifest** lists every art id, what it's for, and its states. The screens ask for art only by id, never by path. Store item ids map to art ids by convention (`stickers/<id>`, `outfits/<kind>-<id>`).
- **Swapping an image:** replace the file with the same name. Vite picks it up by import glob, with no code change. A PNG is used where no SVG of that name exists.
- **Layered art:** the mascot and its outfits share one canvas size (for example 400×400). Outfit files are drawn in place on that canvas, so they stack on the body with no offsets in code.
- **Moods** (happy, wow) are separate face files on the same canvas.
- **The star jar** is a jar image and a lid image, with stars drawn by code inside a mask, because its fill is data. Its art is still swappable.
- **Animations** live in one module of named CSS keyframe animations: fly-in, fly-out, confetti, twinkle, bounce, ticket-slide, pop. Each has its duration and easing in one place, and the screens use them by name. They animate only transform and opacity, for the frame.
- **The Art Gallery** is a separate page, `art-gallery.html`, served by the same server. It's included in development builds and left out of release builds.
  - It renders every manifest entry at real size on the observatory's background.
  - It shows each state: the jar from empty to full at each size, the mascot bare and in every outfit and mood, every sticker, and every constellation empty, part-filled and full.
  - Each animation has a replay button.
  - Missing files are flagged in red.
  - It opens on any screen, including the picture frame over the kiosk app, so performance is judged on the real hardware.
- **Why not Storybook:** it would add a large dev dependency and a second server and port to put behind Tailscale. It also wouldn't run on the frame's old browser. The Art Gallery uses the same build as the observatory, so what you see there is what the kids get.

### Front end (observatory)

- The prototype is rewritten, not copied. It becomes a small set of components:
  - art: Star, Mascot, StarJar, Sticker, Constellation, Confetti, TwinklingSky, FlyingStars;
  - screens: WhoAreYou, Dome, CategoryPlanets, Printing, Scanned, Store, StickerBook, MySky.
- It keeps the existing observatory actions and live connection: print, reprint request, scan outcomes over the WebSocket, and the grown-up PIN into the Control Center.
- **Jar size** is presentation, worked out from `earned` (from the prototype): capacity is the first of 10, 25, 50, 100, 200 that is greater than lifetime earned, otherwise 500. The fill shows the balance. Since balance ≤ earned, the jar never overflows.
- **Constellations** are presentation, worked out from `earned`. There's an ordered built-in list of real constellations, starting with the prototype's five (Cassiopeia, Cygnus, Little Dipper, Big Dipper, Orion), extended to about 12. Stars fill them in order. Past the last one, the sky starts over as a second, golden round, so it never runs out.
- **Fixed stage:** an 800×1280 portrait stage, scaled to fit the screen as in the prototype.
- **Platform limits:** these follow the frame measurements below.
- **Grown-up actions:** the PIN button for grown-ups stays reachable and unobtrusive, in a corner of the who-are-you screen.

### The frame (measured)

The frame has been rooted and measured. Its report is "PF1007L Frame Dashboard Reference" (https://claude.ai/artifact/Rk9mZeTULqefEDywTJKrdD). It's an Allwinner A33 (ARMv7, about 1.3 GHz), with an OpenGL ES 2.0 GPU, about 1 GiB RAM and Android 6.0.1. It runs the full-screen WebView kiosk app `com.wesbos.homehq`, which loads one saved URL. Decisions that follow from it:

- **Browser:**
  - The engine is Android System WebView 106. The build target is `chrome106`, with CSS target `chrome61`, which stops the minifier emitting 4- and 8-digit hex colours. This WebView rejects those.
  - Not available: `:has()` (failed on the frame), CSS nesting, `dvh`, `oklch()` and `color-mix()`, `toSorted` and the other ES2023+ helpers, and `alert`/`confirm`/`prompt` (they silently do nothing).
  - Also unavailable: Web Push, the Fullscreen API, the camera, and new windows (`target="_blank"` strands the kiosk).
- **Portrait:**
  - The OS presents the screen as 1280×800 landscape (the panel is physically portrait).
  - The observatory's 800×1280 stage turns a quarter turn only when its URL asks (`?turn=right` or `?turn=left`, to match how the frame hangs). The frame's kiosk address includes it, so the kiosk app needs no change. Without it, as on a computer, the stage stays upright and fits the window. Touch follows CSS transforms, so taps still land.
- **Animations must end:**
  - On the frame, one looping CSS animation costs about a whole CPU core, and a finished one costs nothing.
  - So nothing animates forever: no endless twinkle, bob or spin. The animations module only allows a finite repeat count, enforced by its type.
  - The starry background is a static picture (`sky`, a replaceable file).
  - The mascot does a short bounce when something happens, not a constant bob.
  - Finished constellations sparkle once when My sky opens.
  - At most about 15 things animate at once, so confetti is 12 pieces.
  - Big blurs, `backdrop-filter`, animated shadows, video and canvas or WebGL are out.
- **Touch:** single taps only. Two fingers close together register as one touch, and a two-finger hold opens the kiosk's own menu, so nothing uses multi-touch or long-press.
- **Pictures:** the screen is 1× (density 160), so art is drawn at display size with no 2× images. The art folder takes SVG, WebP, PNG or JPEG, in that order of preference. A self-hosted rounded font (OFL licence, woff2) lives in the art folder, because Android 6 lacks the prototype's fonts and the frame can't use font CDNs.
- **Looking after itself:** the frame runs for weeks with no keyboard or reload button, and its Wi-Fi comes up after the kiosk has loaded the page.
  - Every observatory request retries with backoff.
  - It keeps showing the last good data, quietly marked as stale.
  - The live connection reconnects with backoff.
  - The page reloads itself once a night, at 3am in the chart's time zone.
  - HTML is served `Cache-Control: no-cache` (assets have hashed names), so a deploy shows up on the next reload.
- **Idle:** after a minute with no taps, the child's screen goes back to Who are you, so the next child starts fresh and nothing sits still all day.
- **Grown-ups on the frame:** the Control Center also opens on the frame, behind a PIN. Its `confirm()` and `prompt()` calls (removing a child, rejecting with a note, unpairing and so on) silently do nothing there, so they're replaced with in-page dialogs.
- **Reaching the server:** the frame can't run Tailscale or resolve `.local` names, so Star Chart is deployed as a public HTTPS website that everything reaches over Wi-Fi. The frame doesn't trust Let's Encrypt certificates (no ISRG Root X1), so the site sits behind Cloudflare, with a certificate from Google Trust Services, which the frame loads. See the "deploy as a public website" ticket.

## Testing Decisions

- **Good tests** check behaviour through the public interface only: what an observatory or grown-up sees over HTTP and the live WebSocket. They never reach into the database. Expected values come from worked examples, such as "Nova earned 3 since last visit", never recomputed the way the code does.
- **Seam 1, the HTTP API and live device connections (existing):**
  - visits and new stars;
  - `earned`;
  - store listing;
  - purchases, including not enough stars, already owned, concurrent purchases, purchases in the Star History, and keeping charts apart;
  - adding store items, including who's allowed;
  - wearing and the wardrobe;
  - the Star History rename.
- **Fakes:** only at the edges, as before (FakeClock for "since last visit").
- **Prior art:**
  - `redemptions-and-constellation.test.ts`: balance rules, concurrency, the history;
  - `observatories.test.ts` and `children.test.ts`: screen-scoped endpoints and charts kept apart;
  - `guest-pins.test.ts`: who's refused;
  - `quiz-feed.test.ts`: an endpoint for admins only.
- **Seam 2, the observatory journey in a real browser (existing smoke test):** extend the Playwright smoke test with The Dome:
  - pick a child, see new stars land, print a task, scan it, buy a sticker, see it in the sticker book, open My sky;
  - run at 800×1280.
  - It checks the pieces are wired together, not how they look. How it looks is judged by the project owner on the real screen.
- **The Art Gallery** is a review tool for the project owner. The smoke test only loads it and checks that every manifest entry resolves to a file (nothing flagged missing), so a replaced or renamed image can't silently break.
- **Presentation rules** (jar size, constellation filling) are pure functions on the front end. They're covered through the smoke test, with no separate unit-test seam.

## Out of Scope

- A Control Center screen for the store (pricing, hiding or removing items). It's API-only for now.
- Removing items from a chart's store, or changing a price after adding.
- Selling items back, refunds, or grown-ups undoing a purchase. A grown-up can't reverse a purchase yet. If needed, that's a later "give stars" feature.
- Mascot naming, choosing a different mascot, or more outfit kinds than hats and hair.
- Sound.
- A night-time dim mode against burn-in. The idle return to Who are you keeps the screen changing for now.
- The printer and scanner hardware. The frame has no usable camera for the page, so the scanner will be a separate part as planned.
- Changes to tickets, approvals, chores, quizzes or the Control Center beyond renaming the Star History.

## Further Notes

- The verdict was unanimous for A, with nothing borrowed from B or C.
- The frame is an AiMOR PF1007L (Allwinner A33, Android 6.0.1, WebView 106), rooted and running the `com.wesbos.homehq` kiosk app. See "The frame (measured)" above and the frame report for details.
- Prices are deliberately low (2–8 stars) so the first purchase comes within a day or two of chores.
