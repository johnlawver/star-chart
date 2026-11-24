import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();

/** Nova with 30 stars to spend, and ways to buy, dress her mascot, and see her as the observatory does. */
async function nova() {
  const chart = await chartWithObservatory(harness);
  const novaId = await chart.addChild("Nova");
  const printer = await chart.connectPrinter();
  harness.clock.advanceBy(60_000);
  const chore = await chart.addChore("Big chore", 30, [novaId]);
  const { ticketId } = await chart.print(novaId, chore, printer);
  await chart.owner.post(`/api/tickets/${ticketId}/approve`, {});
  const buy = (storeItemId: string) => chart.screen.post(`/api/observatory/children/${novaId}/purchases`, { storeItemId });
  const wear = (wearing: { hat: string | null; hair: string | null }, screen = chart.screen) =>
    screen.put(`/api/observatory/children/${novaId}/mascot`, wearing);
  const view = async (screen = chart.screen) => (await screen.get(`/api/observatory/children/${novaId}`)).body.child;
  return { chart, novaId, printer, buy, wear, view };
}

describe("outfits in the store", () => {
  test("hats and hairstyles are for sale after the stickers, and buying one works like a sticker", async () => {
    const { chart, buy, view, printer } = await nova();

    const store = (await chart.screen.get("/api/observatory/store")).body.items;
    const bought = await buy("crown");

    expect(store.map((item: { id: string }) => item.id)).toEqual(["rocket", "moon", "planet", "alien", "comet", "crown", "wizard", "helmet", "spiky", "curly"]);
    expect(store[5]).toEqual({ id: "crown", kind: "hat", name: "Crown", price: 6, art: null });
    expect(bought.status).toBe(201);
    expect(bought.body.wardrobe).toEqual({ owned: ["crown"], wearing: { hat: null, hair: null } });
    expect((await view()).balance).toBe(24);
    printer.close();
  });
});

describe("dressing the mascot", () => {
  test("a child puts on a hat and a hairstyle they own, and takes the hat off again", async () => {
    const { buy, wear, view, printer } = await nova();
    await buy("wizard");
    await buy("curly");

    const dressed = await wear({ hat: "wizard", hair: "curly" });
    const hatOff = await wear({ hat: null, hair: "curly" });

    expect(dressed.status).toBe(200);
    expect(dressed.body).toEqual({ owned: ["wizard", "curly"], wearing: { hat: "wizard", hair: "curly" } });
    expect(hatOff.body.wearing).toEqual({ hat: null, hair: "curly" });
    expect((await view()).wardrobe.wearing).toEqual({ hat: null, hair: "curly" });
    printer.close();
  });

  test("a child can't wear something they haven't bought, or put a hairstyle where a hat goes", async () => {
    const { buy, wear, view, printer } = await nova();
    await buy("spiky");
    await buy("rocket");

    const notOwned = await wear({ hat: "crown", hair: null });
    const wrongPlace = await wear({ hat: "spiky", hair: null });
    const aSticker = await wear({ hat: null, hair: "rocket" });

    expect([notOwned.status, wrongPlace.status, aSticker.status]).toEqual([409, 409, 409]);
    expect((await view()).wardrobe.wearing).toEqual({ hat: null, hair: null });
    printer.close();
  });

  test("the mascot wears the same outfit on every observatory, and on the who-are-you screen", async () => {
    const { chart, buy, wear, printer } = await nova();
    const kitchen = await chart.pairAnotherScreen();
    await buy("helmet");

    await wear({ hat: "helmet", hair: null });
    const children = (await kitchen.get("/api/observatory/children")).body.children;

    expect(children).toEqual([{ id: expect.any(String), nickname: "Nova", displayStyle: "words", wearing: { hat: "helmet", hair: null } }]);
    printer.close();
  });

  test("dressing a child who isn't in this chart, or doesn't exist, is not found", async () => {
    const { novaId, printer } = await nova();
    const school = await chartWithObservatory(harness, "Room 12");

    const theirs = await school.screen.put(`/api/observatory/children/${novaId}/mascot`, { hat: null, hair: null });
    const nobody = await school.screen.put("/api/observatory/children/not-a-child/mascot", { hat: null, hair: null });

    expect([theirs.status, nobody.status]).toEqual([404, 404]);
    printer.close();
  });
});
