# 07: Adding store items

**What to build:** An owner or admin adds another item from the built-in list to their chart's store, optionally at a different price, through an API endpoint. There's no Control Center screen for it yet.

**Blocked by:** 06 (Store with stickers, and the Sticker Book)

**Status:** ready-for-agent

- [ ] `POST /api/store-items {itemId, price?}` (owner or admin):
  - 201 adds it at the end of the store, at the default price unless one is given (1–10,000);
  - 400 for an id not in the built-in list;
  - 409 if it's already in the store.
- [ ] Grown-ups who aren't admins get 403, guests get 403, and observatories and feed keys are refused.
- [ ] The added item shows in the observatory's store and can be bought.
- [ ] A chart's additions never appear in another chart's store.
- [ ] The README or a short doc lists the built-in item ids for whoever calls the endpoint.
