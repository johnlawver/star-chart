# 09: Mascot outfits

**What to build:** Children buy hats and hairstyles (**Outfits**) in the store and dress their **Mascot**: at most one hat and one hairstyle, removable again. The mascot wears the choice everywhere it appears, on every observatory.

**Blocked by:** 07 (Store with stickers, and the Sticker Book)

**Status:** ready-for-agent

- [ ] Hats and hair are buyable in the store, with the same rules as stickers.
- [ ] The child's observatory view and the purchase response include the wardrobe: `{ owned: itemId[], wearing: { hat, hair } }`.
- [ ] `PUT /api/observatory/children/:childId/mascot {hat, hair}` (screen), with each an owned item of the right kind or null:
  - 200 returns the wardrobe;
  - 409 for an item not owned or of the wrong kind;
  - 404 for a child that isn't found or isn't yours.
- [ ] The who-are-you list includes each child's `wearing`.
- [ ] Wearing is per child, so a second observatory shows the same outfit (API test).
- [ ] The Dome lets a child put on or take off owned outfits by tapping them, for example from the store or the mascot. The mascot shows them in the dome, on the who-are-you planet and in the store.
- [ ] The smoke test buys a hat, puts it on, and sees it on the who-are-you screen.
