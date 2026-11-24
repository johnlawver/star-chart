import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();

// The smallest real PNG (a 1×1 transparent pixel), a tiny SVG, and a JPEG's opening bytes.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#f80"/></svg>');

/** Nova in a fresh chart with stars to spend, and the store as the observatory sees it. */
async function chartWithStars() {
  const chart = await chartWithObservatory(harness);
  const novaId = await chart.addChild("Nova");
  const printer = await chart.connectPrinter();
  harness.clock.advanceBy(60_000);
  const chore = await chart.addChore("Big chore", 20, [novaId]);
  const { ticketId } = await chart.print(novaId, chore, printer);
  await chart.owner.post(`/api/tickets/${ticketId}/approve`, {});
  const store = async () => (await chart.screen.get("/api/observatory/store")).body.items;
  return { chart, novaId, printer, store };
}

describe("uploading pictures", () => {
  test("an owner uploads a sticker picture, and it's served back exactly, cached for good", async () => {
    const { chart, printer } = await chartWithStars();

    const uploaded = await chart.owner.upload("/api/art-files", png, "image/png");
    const served = await chart.screen.getRaw(uploaded.body.url);

    expect(uploaded.status).toBe(201);
    expect(uploaded.body).toEqual({ id: expect.any(String), url: `/api/art-files/${uploaded.body.id}` });
    expect(served.status).toBe(200);
    expect(served.headers["content-type"]).toBe("image/png");
    expect(served.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(served.bytes.equals(png)).toBe(true);
    printer.close();
  });

  test("an SVG is served so that nothing inside it can run", async () => {
    const { chart, printer } = await chartWithStars();

    const uploaded = await chart.owner.upload("/api/art-files", svg, "image/svg+xml");
    const served = await chart.screen.getRaw(uploaded.body.url);

    expect(served.headers["content-type"]).toBe("image/svg+xml");
    expect(served.headers["content-security-policy"]).toContain("script-src 'none'");
    expect(served.headers["x-content-type-options"]).toBe("nosniff");
    printer.close();
  });

  test("a file that isn't really a picture is refused, whatever it claims to be", async () => {
    const { chart, printer } = await chartWithStars();

    const pretending = await chart.owner.upload("/api/art-files", Buffer.from("hello, I am a PNG"), "image/png");
    const textFile = await chart.owner.upload("/api/art-files", Buffer.from("hello"), "text/plain");
    const jpegClaimingPng = await chart.owner.upload("/api/art-files", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]), "image/png");

    expect([pretending.status, textFile.status, jpegClaimingPng.status]).toEqual([400, 415, 400]);
    printer.close();
  });

  test("a picture over 1 MB is refused", async () => {
    const { chart, printer } = await chartWithStars();
    const huge = Buffer.concat([png, Buffer.alloc(1024 * 1024)]);

    expect((await chart.owner.upload("/api/art-files", huge, "image/png")).status).toBe(413);
    printer.close();
  });

  test("only owners and admins upload pictures", async () => {
    const { chart, printer } = await chartWithStars();
    const partner = await chart.inviteGrownUp();

    expect((await partner.upload("/api/art-files", png, "image/png")).status).toBe(403);
    expect((await harness.newClient().upload("/api/art-files", png, "image/png")).status).toBe(401);
    printer.close();
  });
});

describe("adding to the store", () => {
  test("an owner adds a built-in sticker, at the end of the store and at its usual price", async () => {
    const { chart, store, printer } = await chartWithStars();

    const added = await chart.owner.post("/api/store-items", { itemId: "ufo" });

    expect(added.status).toBe(201);
    expect((await store()).at(-1)).toEqual({ id: "ufo", kind: "sticker", name: "Flying saucer", price: 3, art: null });
    printer.close();
  });

  test("a built-in item can be added at a different price", async () => {
    const { chart, store, printer } = await chartWithStars();

    await chart.owner.post("/api/store-items", { itemId: "telescope", price: 7 });

    expect((await store()).at(-1)).toMatchObject({ id: "telescope", price: 7 });
    printer.close();
  });

  test("an item that isn't built in, or is already in the store, or has a silly price, is refused", async () => {
    const { chart, printer } = await chartWithStars();

    const unknown = await chart.owner.post("/api/store-items", { itemId: "unicorn" });
    const twice = await chart.owner.post("/api/store-items", { itemId: "rocket" });
    const free = await chart.owner.post("/api/store-items", { itemId: "ufo", price: 0 });

    expect([unknown.status, twice.status, free.status]).toEqual([400, 409, 400]);
    printer.close();
  });

  test("an owner uploads their own sticker, names and prices it, and a child can buy it", async () => {
    const { chart, novaId, store, printer } = await chartWithStars();
    const picture = (await chart.owner.upload("/api/art-files", png, "image/png")).body;

    const added = await chart.owner.post("/api/store-items", { name: "Dragon", price: 5, artFileId: picture.id });
    const listed = (await store()).at(-1);
    const bought = await chart.screen.post(`/api/observatory/children/${novaId}/purchases`, { storeItemId: listed.id });

    expect(added.status).toBe(201);
    expect(listed).toEqual({ id: expect.any(String), kind: "sticker", name: "Dragon", price: 5, art: picture.url });
    expect(bought.status).toBe(201);
    expect(bought.body.wardrobe.owned).toEqual([listed.id]);
    printer.close();
  });

  test("grown-ups see the store, and the built-in items they could still add", async () => {
    const { chart, printer } = await chartWithStars();
    await chart.owner.post("/api/store-items", { itemId: "ufo" });

    const { items, available } = (await chart.owner.get("/api/store-items")).body;

    expect(items.map((item: { id: string }) => item.id)).toEqual(["rocket", "moon", "planet", "alien", "comet", "ufo"]);
    expect(available).toEqual([
      { id: "astronaut", kind: "sticker", name: "Astronaut", price: 5 },
      { id: "telescope", kind: "sticker", name: "Telescope", price: 4 },
    ]);
    printer.close();
  });

  test("only owners and admins add to the store", async () => {
    const { chart, printer } = await chartWithStars();
    const partner = await chart.inviteGrownUp();

    expect((await partner.post("/api/store-items", { itemId: "ufo" })).status).toBe(403);
    printer.close();
  });
});

describe("changing what's in the store", () => {
  test("an owner changes an item's price, and the store shows the new price", async () => {
    const { chart, store, printer } = await chartWithStars();

    const changed = await chart.owner.patch("/api/store-items/rocket", { price: 9 });

    expect(changed.status).toBe(200);
    expect((await store())[0]).toMatchObject({ id: "rocket", price: 9 });
    printer.close();
  });

  test("an owner replaces a built-in item's picture with their own, and can go back to the original", async () => {
    const { chart, store, printer } = await chartWithStars();
    const picture = (await chart.owner.upload("/api/art-files", png, "image/png")).body;

    await chart.owner.patch("/api/store-items/moon", { artFileId: picture.id });
    const replaced = (await store())[1];
    await chart.owner.patch("/api/store-items/moon", { artFileId: null });
    const original = (await store())[1];

    expect(replaced).toEqual({ id: "moon", kind: "sticker", name: "Moon", price: 2, art: picture.url });
    expect(original).toMatchObject({ id: "moon", art: null });
    printer.close();
  });

  test("an uploaded sticker's picture can be replaced, but not removed (it has no original)", async () => {
    const { chart, store, printer } = await chartWithStars();
    const first = (await chart.owner.upload("/api/art-files", png, "image/png")).body;
    const second = (await chart.owner.upload("/api/art-files", svg, "image/svg+xml")).body;
    const { id } = (await chart.owner.post("/api/store-items", { name: "Dragon", price: 5, artFileId: first.id })).body;

    const replaced = await chart.owner.patch(`/api/store-items/${id}`, { artFileId: second.id });
    const removed = await chart.owner.patch(`/api/store-items/${id}`, { artFileId: null });

    expect(replaced.status).toBe(200);
    expect(removed.status).toBe(400);
    expect((await store()).at(-1)).toMatchObject({ name: "Dragon", art: second.url });
    printer.close();
  });

  test("a child who already bought an item keeps it when its price changes", async () => {
    const { chart, novaId, store, printer } = await chartWithStars();
    await chart.screen.post(`/api/observatory/children/${novaId}/purchases`, { storeItemId: "comet" });

    await chart.owner.patch("/api/store-items/comet", { price: 12 });

    expect((await chart.screen.get(`/api/observatory/children/${novaId}`)).body.child.wardrobe.owned).toEqual(["comet"]);
    expect((await store())[4]).toMatchObject({ id: "comet", price: 12 });
    printer.close();
  });

  test("changing an item that isn't in the store, with someone else's picture, or as a plain grown-up, is refused", async () => {
    const { chart, printer } = await chartWithStars();
    const other = await chartWithStars();
    const theirPicture = (await other.chart.owner.upload("/api/art-files", png, "image/png")).body;
    const partner = await chart.inviteGrownUp();

    const missing = await chart.owner.patch("/api/store-items/telescope", { price: 3 });
    const borrowed = await chart.owner.patch("/api/store-items/rocket", { artFileId: theirPicture.id });
    const notAdmin = await partner.patch("/api/store-items/rocket", { price: 1 });
    const silly = await chart.owner.patch("/api/store-items/rocket", { price: 0 });

    expect([missing.status, borrowed.status, notAdmin.status, silly.status]).toEqual([404, 404, 403, 400]);
    printer.close();
    other.printer.close();
  });
});

describe("keeping charts apart", () => {
  test("a chart can't put another chart's picture in its store, and its own additions stay its own", async () => {
    const ours = await chartWithStars();
    const theirs = await chartWithStars();
    const theirPicture = (await theirs.chart.owner.upload("/api/art-files", png, "image/png")).body;

    const borrowed = await ours.chart.owner.post("/api/store-items", { name: "Not ours", price: 2, artFileId: theirPicture.id });
    await theirs.chart.owner.post("/api/store-items", { name: "Theirs", price: 2, artFileId: theirPicture.id });

    expect(borrowed.status).toBe(404);
    expect((await ours.store()).map((item: { name: string }) => item.name)).not.toContain("Theirs");
    ours.printer.close();
    theirs.printer.close();
  });
});
