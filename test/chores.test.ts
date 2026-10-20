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
