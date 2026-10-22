import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();
const { clock } = harness;

/** Nova with one chore, in a chart whose time zone is America/Chicago (set by chartWithObservatory). */
async function novaWithChore(frequency?: { times: number; per: "day" | "week" }) {
  const chart = await chartWithObservatory(harness);
  const nova = await chart.addChild("Nova");
  const { category } = (await chart.owner.post("/api/categories", { name: "Chores", kind: "chore" })).body;
  const { chore } = (
    await chart.owner.post("/api/chores", {
      categoryId: category.id,
      name: "Feed the cat",
      stars: 2,
      childIds: [nova],
      ...(frequency ? { frequency } : {}),
    })
  ).body;
  const printer = await chart.connectPrinter();
  const print = () =>
    chart.screen.post(`/api/observatory/children/${nova}/tickets`, { kind: "chore", taskId: chore.id });
  /** Prints the chore and approves it straight away, as if Nova did it and a grown-up checked. */
  const doIt = async () => {
    const printed = await print();
    await printer.nextMessage();
    await chart.owner.post(`/api/tickets/${printed.body.ticket.id}/approve`, {});
  };
  const isDone = async () =>
    (await chart.screen.get(`/api/observatory/children/${nova}/menu`)).body.categories[0].choices[0].done;
  return { chart, nova, chore, printer, print, doIt, isDone };
}

describe("chore frequency", () => {
  test("a chore approved today shows as done, and can't be printed again today", async () => {
    clock.set(new Date("2026-10-20T14:00:00Z")); // 9am in Chicago
    const { print, doIt, isDone, printer } = await novaWithChore();
    expect(await isDone()).toBe(false);

    await doIt();

    expect(await isDone()).toBe(true);
    const again = await print();
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/already done/i);
    printer.close();
  });

  test("the day starts again at midnight in the chart's time zone, not the server's", async () => {
    clock.set(new Date("2026-10-20T23:00:00Z")); // 6pm in Chicago
    const { doIt, isDone, printer } = await novaWithChore();
    await doIt();

    clock.set(new Date("2026-10-21T01:00:00Z")); // past midnight UTC, but still 8pm in Chicago
    const stillDoneThatEvening = await isDone();
    clock.set(new Date("2026-10-21T05:01:00Z")); // 12:01am in Chicago
    const availableAfterLocalMidnight = !(await isDone());

    expect(stillDoneThatEvening).toBe(true);
    expect(availableAfterLocalMidnight).toBe(true);
    printer.close();
  });

  test("a chore set to twice a day can be done twice before it's done for the day", async () => {
    clock.set(new Date("2026-10-20T13:00:00Z")); // 8am in Chicago
    const { doIt, isDone, printer } = await novaWithChore({ times: 2, per: "day" });

    await doIt();
    const afterMorning = await isDone();
    await doIt();
    const afterBedtime = await isDone();

    expect(afterMorning).toBe(false);
    expect(afterBedtime).toBe(true);
    printer.close();
  });

  test("a weekly chore stays done until Monday at midnight in the chart's time zone", async () => {
    clock.set(new Date("2026-10-21T15:00:00Z")); // Wednesday, 10am in Chicago
    const { doIt, isDone, printer } = await novaWithChore({ times: 1, per: "week" });
    await doIt();

    clock.set(new Date("2026-10-26T04:59:00Z")); // Sunday, 11:59pm in Chicago
    const stillDoneOnSunday = await isDone();
    clock.set(new Date("2026-10-26T05:00:00Z")); // Monday, midnight in Chicago
    const availableOnMonday = !(await isDone());

    expect(stillDoneOnSunday).toBe(true);
    expect(availableOnMonday).toBe(true);
    printer.close();
  });

  test("grown-ups see each chore's frequency, which defaults to once a day", async () => {
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const { category } = (await chart.owner.post("/api/categories", { name: "Chores", kind: "chore" })).body;
    await chart.owner.post("/api/chores", { categoryId: category.id, name: "Brush teeth", stars: 1, childIds: [nova], frequency: { times: 2, per: "day" } });
    await chart.owner.post("/api/chores", { categoryId: category.id, name: "Make your bed", stars: 1, childIds: [nova] });

    const [chores] = (await chart.owner.get("/api/categories")).body.categories.map((c: any) => c.chores);

    expect(chores.map((chore: any) => [chore.name, chore.frequency])).toEqual([
      ["Brush teeth", { times: 2, per: "day" }],
      ["Make your bed", { times: 1, per: "day" }],
    ]);
  });
});

describe("unfinished chores carry over (ADR 0001)", () => {
  test("a chore ticket printed yesterday and never finished still hands in today", async () => {
    clock.set(new Date("2026-10-20T23:00:00Z")); // 6pm in Chicago
    const { chart, print, printer } = await novaWithChore();
    await print();
    const { code } = (await printer.nextMessage()).ticket;
    const scanner = await chart.connectScanner();
    const screen = await chart.connectScreen();

    clock.set(new Date("2026-10-21T13:00:00Z")); // the next morning
    scanner.send({ type: "scan", code });

    expect(await screen.nextMessage()).toMatchObject({ result: "handed-in", title: "Feed the cat" });
    [printer, scanner, screen].forEach((connection) => connection.close());
  });
});
