# 07: Store with stickers, and the Sticker Book

**What to build:** A **Store** button on the dock opens the chart's store, where a child buys **Store Items** with stars. Stars fly out of the jar, and the purchase shows in their **Star History**. A **Sticker Book** button shows every sticker they've bought. Purchases come out of the same Balance as redemptions and need no approval. Each item can be bought once. This ticket sells the stickers; outfits come in 08.

**Blocked by:** 01 (Star History rename), 04 (The Dome)

**Status:** ready-for-agent

- [ ] A built-in list of predefined items in code, each with an id, kind (sticker, hat or hair), name, default price, and whether it's in the starting store. The starting store holds the prototype's 10 items and prices (rocket 2, moon 2, planet 3, alien 4, comet 3, crown 6, wizard 5, helmet 8, spiky 4, curly 4). The list holds a few more.
- [ ] Each chart has its own store (item and price, in order). New charts get the starting store, and a migration gives existing charts the starting store.
- [ ] `GET /api/observatory/store` (screen) lists the chart's store. Outfits are listed but not yet buyable until 08, or are left out until then, whichever keeps the store honest.
- [ ] `POST /api/observatory/children/:childId/purchases {storeItemId}` (screen):
  - 201 returns the new balance and what the child owns;
  - 409 "not enough stars" returns the balance;
  - 409 "already owned";
  - 404 for a child or item that isn't found or isn't yours.
- [ ] Concurrent purchases and redemptions can't overspend. Ten parallel purchases leave the balance correct (API test, prior art: redemptions).
- [ ] Purchases appear in the Star History as spent, "Bought: <item name>", with the price.
- [ ] One chart's store and purchases never reach another chart (API test).
- [ ] The Dome's store shows items at real size with prices (number plus star). Unaffordable items look it, and owned items show as owned. Buying flies stars out of the jar and updates the balance.
- [ ] The Sticker Book shows every sticker bought, or a friendly empty page pointing to the store.
- [ ] The smoke test buys a sticker and finds it in the sticker book.
