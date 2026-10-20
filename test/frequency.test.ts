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
    chart.screen.post(`/api/observatory/children/${nova}/tickets`, { categoryId: category.id, choiceId: chore.id });
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
});
