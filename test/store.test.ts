import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();

/** Nova in a fresh chart, with a way to earn stars (a chore a grown-up approves) and to buy from the store. */
async function nova() {
  const chart = await chartWithObservatory(harness);
  const novaId = await chart.addChild("Nova");
  const printer = await chart.connectPrinter();
  const earn = async (stars: number) => {
    harness.clock.advanceBy(60_000);
    const chore = await chart.addChore(`Chore worth ${stars}`, stars, [novaId]);
    const { ticketId } = await chart.print(novaId, chore, printer);
    await chart.owner.post(`/api/tickets/${ticketId}/approve`, {});
  };
  const buy = (storeItemId: string, childId = novaId, screen = chart.screen) => {
    harness.clock.advanceBy(1000);
    return screen.post(`/api/observatory/children/${childId}/purchases`, { storeItemId });
  };
  const view = async () => (await chart.screen.get(`/api/observatory/children/${novaId}`)).body.child;
  return { chart, novaId, printer, earn, buy, view };
}

describe("the store", () => {
  test("a new chart's store starts with the stickers, in order, at their starting prices", async () => {
    const { chart, printer } = await nova();

    const store = await chart.screen.get("/api/observatory/store");

    expect(store.status).toBe(200);
    expect(store.body.items).toEqual([
      { id: "rocket", kind: "sticker", name: "Rocket", price: 2, art: null },
      { id: "moon", kind: "sticker", name: "Moon", price: 2, art: null },
      { id: "planet", kind: "sticker", name: "Ringed planet", price: 3, art: null },
      { id: "alien", kind: "sticker", name: "Friendly alien", price: 4, art: null },
      { id: "comet", kind: "sticker", name: "Comet", price: 3, art: null },
    ]);
    printer.close();
  });

  test("only an observatory's screen sees the store", async () => {
    const { chart, printer } = await nova();

    expect((await chart.owner.get("/api/observatory/store")).status).toBe(401);
    printer.close();
  });
});

describe("buying from the store", () => {
  test("a child buys a sticker with their stars: the balance goes down and they own it, with no grown-up needed", async () => {
    const { buy, earn, view, printer } = await nova();
    await earn(5);

    const bought = await buy("moon");

    expect(bought.status).toBe(201);
    expect(bought.body).toEqual({ balance: 3, wardrobe: { owned: ["moon"], wearing: { hat: null, hair: null } } });
    expect(await view()).toMatchObject({ balance: 3, earned: 5, wardrobe: { owned: ["moon"], wearing: { hat: null, hair: null } } });
    printer.close();
  });

  test("a child without enough stars can't buy it, and is told their balance", async () => {
    const { buy, earn, view, printer } = await nova();
    await earn(3);

    const tooDear = await buy("alien");

    expect(tooDear.status).toBe(409);
    expect(tooDear.body).toMatchObject({ error: "not enough stars", balance: 3 });
    expect((await view()).wardrobe.owned).toEqual([]);
    printer.close();
  });

  test("each item can be bought only once", async () => {
    const { buy, earn, view, printer } = await nova();
    await earn(10);
    await buy("rocket");

    const again = await buy("rocket");

    expect(again.status).toBe(409);
    expect(again.body.error).toBe("already owned");
    expect((await view()).balance).toBe(8);
    printer.close();
  });

  test("two quick taps on the same item buy it once", async () => {
    const { buy, earn, view, printer } = await nova();
    await earn(10);

    const taps = await Promise.all([buy("rocket"), buy("rocket")]);

    expect(taps.map((tap) => tap.status).sort()).toEqual([201, 409]);
    expect((await view()).balance).toBe(8);
    printer.close();
  });

  test("purchases and grown-ups' redemptions at the same moment can't take the balance below zero", async () => {
    const { chart, novaId, buy, earn, view, printer } = await nova();
    await earn(5);

    // Five different stickers (14 stars in all) and five one-star treats, all at once, against a balance of five.
    const results = await Promise.all([
      ...["rocket", "moon", "planet", "alien", "comet"].map((id) => buy(id)),
      ...Array.from({ length: 5 }, (_, i) => chart.owner.post(`/api/children/${novaId}/redemptions`, { amount: 1, note: `Treat ${i}` })),
    ]);

    expect(results.every((result) => result.status === 201 || result.status === 409)).toBe(true);
    expect((await view()).balance).toBeGreaterThanOrEqual(0);
    const history = (await chart.owner.get(`/api/children/${novaId}/star-history`)).body;
    expect(history.balance).toBe((await view()).balance);
    expect(history.spent).toBeLessThanOrEqual(5);
    printer.close();
  });

  test("a purchase shows in the star history as spent: \"Bought: <item>\" for its price", async () => {
    const { chart, novaId, buy, earn, printer } = await nova();
    await earn(5);
    await buy("planet");

    const history = (await chart.owner.get(`/api/children/${novaId}/star-history`)).body;

    expect(history).toMatchObject({ earned: 5, spent: 3, balance: 2 });
    expect(history.entries[0]).toEqual({ kind: "spent", amount: 3, what: "Bought: Ringed planet", at: expect.any(String) });
    printer.close();
  });

  test("buying something that isn't in the store, or for a child who doesn't exist, is not found", async () => {
    const { buy, earn, printer } = await nova();
    await earn(10);

    const unicorn = await buy("unicorn");
    const nobody = await buy("rocket", "not-a-child");

    expect([unicorn.status, nobody.status]).toEqual([404, 404]);
    printer.close();
  });

  test("outfits aren't for sale yet (they arrive with the mascot's wardrobe)", async () => {
    const { buy, earn, printer } = await nova();
    await earn(10);

    expect((await buy("crown")).status).toBe(404);
    printer.close();
  });
});

describe("keeping charts apart", () => {
  test("another chart's observatory can't buy for our child, and its purchases never show up in ours", async () => {
    const { novaId, buy, earn, view, printer } = await nova();
    await earn(5);
    const school = await chartWithObservatory(harness, "Room 12");
    const theirChild = await school.addChild("Luna");

    const sneaky = await buy("rocket", novaId, school.screen);
    await buy("moon", theirChild, school.screen);

    expect(sneaky.status).toBe(404);
    expect(await view()).toMatchObject({ balance: 5, wardrobe: { owned: [] } });
    printer.close();
  });
});
