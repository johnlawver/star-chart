# 09: Mascot outfits

**What to build:** Children buy hats and hairstyles (**Outfits**) in the store and dress their **Mascot**: at most one hat and one hairstyle, removable again. The mascot wears the choice everywhere it appears, on every observatory.

**Blocked by:** 07 (Store with stickers, and the Sticker Book)

**Status:** done (2026-11-24)

- [x] Hats and hair are buyable in the store, with the same rules as stickers.
- [x] The child's observatory view and the purchase response include the wardrobe: `{ owned: itemId[], wearing: { hat, hair } }`.
- [x] `PUT /api/observatory/children/:childId/mascot {hat, hair}` (screen), with each an owned item of the right kind or null:
  - 200 returns the wardrobe;
  - 409 for an item not owned or of the wrong kind;
  - 404 for a child that isn't found or isn't yours.
- [x] The who-are-you list includes each child's `wearing`.
- [x] Wearing is per child, so a second observatory shows the same outfit (API test).
- [x] The Dome lets a child put on or take off owned outfits by tapping them, for example from the store or the mascot. The mascot shows them in the dome, on the who-are-you planet and in the store.
- [x] The smoke test buys a hat, puts it on, and sees it on the who-are-you screen.

## Comments

2026-11-24: Done.
- **Server:** migration 0033 stores `wearing_hat` and `wearing_hair` per child. Hats and hair are now for sale. `PUT .../mascot` checks that the child owns the item and that it's the right kind (409 otherwise), and the who-are-you list includes `wearing`.
- **Screens:** an owned outfit in the store toggles Wear / Take off, and is highlighted while worn. Outfits show on the mascot in their store tile. The mascot is dressed in the dome and on its Who are you planet; Who are you reloads each time it's shown.
- **Replaced pictures:** a family's replaced outfit pictures (from the Control Center's store page) are used on the mascot everywhere.
