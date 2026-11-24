# 08: Add stickers to the store from the Control Center

**What to build:** An owner or admin shapes their chart's store from the Control Center, one sticker at a time. They can upload their own sticker picture (PNG, WebP, JPEG or SVG), name it and price it, and it goes straight into the store. They can also add an item from the built-in list. Changed 2026-11-24 at the user's request: every picture should eventually be replaceable, hand-drawn art included, so uploaded pictures are stored on the server (in the database for now, behind a small module so a bucket can replace it later). Ticket 13 extends this to every piece of art.

**Blocked by:** 07 (Store with stickers, and the Sticker Book)

**Status:** done (2026-11-24)

- [x] **Uploading a picture:** `POST /api/art-files`, with the image as the request body and its type as the content type. Owners and admins only. It returns `{id, url}` (201). Accepted: PNG, WebP, JPEG and SVG, up to 1 MB, checked by their actual bytes, not just the declared type. Anything else is 400 (wrong type) or 413 (too big).
- [x] **Serving pictures:** `GET /api/art-files/:id` serves the picture with its type, cached for good (pictures never change; a new picture is a new id). SVGs are served with a Content-Security-Policy that stops any script in them from running, plus `nosniff`. A chart can only put its own pictures in its store.
- [x] **Adding items:** `POST /api/store-items` (owner or admin) takes either:
  - a built-in item, `{itemId, price?}`, at the default price unless one is given; 400 if the id isn't in the built-in list; or
  - a new sticker, `{name, price, artFileId}`.
  Either way it's added at the end of the store, with a price from 1 to 10,000. 409 if that built-in item is already in the store.
- [x] Grown-ups who aren't admins get 403, and so do guests.
- [x] The store's listing includes each item's picture: `art` is null for built-in items, whose pictures ship with the app, or the uploaded picture's URL. The observatory's store and Sticker Book show uploaded stickers like any other, and they can be bought.
- [x] A chart's items and pictures never appear in another chart's store.
- [x] **Control Center:** a Store card on the Tasks page lists the store's items, with their pictures and prices. It has "Add from the built-in list" (items not in the store yet) and "Upload a new sticker" (picture, name, price, with a preview before saving).
- [x] The three built-in stickers that aren't in the starting store (flying saucer, astronaut, telescope) get pictures, so they can be added.

## Comments

2026-11-24: Done.
- **Storage:** uploads go into `art_files` (migration 0032), through `src/server/art-files/art-files.ts`, the one place to change for a bucket. The real type is checked by its opening bytes (PNG, JPEG, WebP, SVG). Uploads are limited to 1 MB (413), and an unsupported type gets 415. SVGs are served with `script-src 'none'; sandbox` and `nosniff`.
- **Who sees pictures:** picture addresses are public but unguessable, because screens show them in `<img>` tags, which can't send a device credential.
- **Store items:** `store_items` gains `name`, `kind` and `art_file_id` for a chart's own stickers, whose ids look like `sticker-<hex>`. `GET /api/store-items` (grown-ups) lists the store plus the built-in items still available to add.
- **Control Center:** the Tasks page has a Store card with pictures and prices, "Add from the built-in list", and "Upload a new sticker" with a preview.
- **Built-in art:** stickers for the flying saucer, astronaut and telescope are drawn and added to the manifest.

2026-11-24 (follow-up, the user's request):
- **Its own page:** the store moved to `/store`, a sub-tab of Tasks (Tasks stays highlighted in the navigation).
- **Changing items:** owners and admins can change any item's price and replace any item's picture with `PATCH /api/store-items/:itemId {price?, artFileId?}`. `artFileId: null` puts a built-in item's shipped picture back; a chart's own sticker can't lose its picture (400).
- **Already bought:** a child who bought an item keeps it when its price changes.
