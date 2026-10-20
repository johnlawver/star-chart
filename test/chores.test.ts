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

  test("tapping a chore prints a ticket on the observatory's printer", async () => {
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const { category } = (await chart.owner.post("/api/categories", { name: "Chores", kind: "chore" })).body;
    const { chore } = (
      await chart.owner.post("/api/chores", { categoryId: category.id, name: "Feed the cat", stars: 2, childIds: [nova] })
    ).body;
    const printer = await chart.connectPrinter();

    const printed = await chart.screen.post(`/api/observatory/children/${nova}/tickets`, {
      categoryId: category.id,
      choiceId: chore.id,
    });

    expect(printed.status).toBe(201);
    expect(printed.body.ticket).toEqual({ id: expect.any(String), state: "open" });
    expect(await printer.nextMessage()).toEqual({
      type: "print",
      ticket: {
        id: printed.body.ticket.id,
        childNickname: "Nova",
        displayStyle: "words",
        title: "Feed the cat",
        stars: 2,
        code: expect.any(String),
      },
    });
    printer.close();
  });
});

describe("chores in the Control Center", () => {
  test("a grown-up sees each category with its chores and who they're assigned to", async () => {
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const pip = await chart.addChild("Pip", "pictures");
    const { category } = (await chart.owner.post("/api/categories", { name: "Chores", kind: "chore" })).body;
    await chart.owner.post("/api/chores", { categoryId: category.id, name: "Make your bed", stars: 1, childIds: [nova, pip] });
    await chart.owner.post("/api/chores", { categoryId: category.id, name: "Feed the cat", stars: 2, childIds: [nova] });

    const categories = (await chart.owner.get("/api/categories")).body.categories;

    expect(categories).toEqual([
      {
        id: category.id,
        name: "Chores",
        kind: "chore",
        chores: [
          { id: expect.any(String), name: "Feed the cat", stars: 2, childIds: [nova] },
          { id: expect.any(String), name: "Make your bed", stars: 1, childIds: expect.arrayContaining([nova, pip]) },
        ],
      },
    ]);
  });
});

describe("chore codes (ADR 0001)", () => {
  test("a chore's code is the same every time it's printed for a child, and different for each child", async () => {
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const pip = await chart.addChild("Pip", "pictures");
    const { category } = (await chart.owner.post("/api/categories", { name: "Chores", kind: "chore" })).body;
    const { chore } = (
      await chart.owner.post("/api/chores", { categoryId: category.id, name: "Make your bed", stars: 1, childIds: [nova, pip] })
    ).body;
    const printer = await chart.connectPrinter();
    const print = async (childId: string) => {
      await chart.screen.post(`/api/observatory/children/${childId}/tickets`, { categoryId: category.id, choiceId: chore.id });
      return (await printer.nextMessage()).ticket.code as string;
    };

    const novasFirst = await print(nova);
    const novasSecond = await print(nova);
    const pips = await print(pip);

    expect(novasSecond).toBe(novasFirst);
    expect(pips).not.toBe(novasFirst);
    printer.close();
  });

  test("a chore's code doesn't reveal the child or the chore", async () => {
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const { category } = (await chart.owner.post("/api/categories", { name: "Chores", kind: "chore" })).body;
    const { chore } = (
      await chart.owner.post("/api/chores", { categoryId: category.id, name: "Make your bed", stars: 1, childIds: [nova] })
    ).body;
    const printer = await chart.connectPrinter();

    await chart.screen.post(`/api/observatory/children/${nova}/tickets`, { categoryId: category.id, choiceId: chore.id });
    const { code } = (await printer.nextMessage()).ticket;

    expect(code).not.toContain(nova);
    expect(code).not.toContain(chore.id);
    expect(code).toMatch(/^SC-[2-9A-HJ-NP-Z]{12}$/);
    printer.close();
  });
});

describe("keeping chores to the right child and chart", () => {
  async function homeWithChore() {
    const chart = await chartWithObservatory(harness, "Our House");
    const nova = await chart.addChild("Nova");
    const pip = await chart.addChild("Pip", "pictures");
    const { category } = (await chart.owner.post("/api/categories", { name: "Chores", kind: "chore" })).body;
    const { chore } = (
      await chart.owner.post("/api/chores", { categoryId: category.id, name: "Feed the cat", stars: 2, childIds: [nova] })
    ).body;
    return { chart, nova, pip, category, chore };
  }

  test("a child can't print a chore that isn't assigned to them", async () => {
    const { chart, pip, category, chore } = await homeWithChore();

    const printed = await chart.screen.post(`/api/observatory/children/${pip}/tickets`, {
      categoryId: category.id,
      choiceId: chore.id,
    });

    expect(printed.status).toBe(404);
  });

  test("another chart's observatory can't see our children's menus or print their chores", async () => {
    const { nova, category, chore } = await homeWithChore();
    const school = await chartWithObservatory(harness, "Room 12");

    const menu = await school.screen.get(`/api/observatory/children/${nova}/menu`);
    const printed = await school.screen.post(`/api/observatory/children/${nova}/tickets`, {
      categoryId: category.id,
      choiceId: chore.id,
    });

    expect(menu.status).toBe(404);
    expect(printed.status).toBe(404);
  });

  test("a grown-up can't add a chore to another chart's category or assign it to another chart's child", async () => {
    const { nova, category } = await homeWithChore();
    const school = await chartWithObservatory(harness, "Room 12");
    const ava = await school.addChild("Ava");
    const { category: schoolCategory } = (await school.owner.post("/api/categories", { name: "Jobs", kind: "chore" })).body;

    const intoOurCategory = await school.owner.post("/api/chores", {
      categoryId: category.id,
      name: "Sneaky",
      stars: 1,
      childIds: [ava],
    });
    const forOurChild = await school.owner.post("/api/chores", {
      categoryId: schoolCategory.id,
      name: "Sneaky",
      stars: 1,
      childIds: [nova],
    });

    expect(intoOurCategory.status).toBe(400);
    expect(forOurChild.status).toBe(400);
  });
});
