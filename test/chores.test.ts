import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();

describe("chores at the observatory", () => {
  test("a child sees the chores assigned to them, and nothing that isn't theirs", async () => {
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const pip = await chart.addChild("Pip", "pictures");
    const { category } = (await chart.owner.post("/api/categories", { name: "Chores", kind: "chore" })).body;
    await chart.owner.post("/api/chores", {
      categoryId: category.id,
      name: "Feed the cat",
      stars: 2,
      childIds: [nova],
    });

    const novasMenu = (await chart.screen.get(`/api/observatory/children/${nova}/menu`)).body.categories;
    const pipsMenu = (await chart.screen.get(`/api/observatory/children/${pip}/menu`)).body.categories;

    expect(novasMenu).toEqual([
      {
        id: category.id,
        name: "Chores",
        kind: "chore",
        choices: [{ id: expect.any(String), name: "Feed the cat", stars: 2 }],
      },
    ]);
    expect(pipsMenu).toEqual([]);
  });
});
