import { describe, expect, test } from "vitest";
import { fakeSubscription } from "./support/fake-push.js";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();
const { push, clock } = harness;

/** Nova with a printed chore ticket; the observatory's scanner and screen connected; the owner's phone subscribed. */
async function novaWithAPrintedChore() {
  const chart = await chartWithObservatory(harness);
  const nova = await chart.addChild("Nova");
  const chore = await chart.addChore("Feed the cat", 2, [nova]);
  const printer = await chart.connectPrinter();
  const scanner = await chart.connectScanner();
  const screen = await chart.connectScreen();
  const phone = fakeSubscription();
  await chart.owner.post("/api/push/subscriptions", phone);
  const printed = await chart.print(nova, chore, printer);
  const handIn = async (code = printed.code) => {
    scanner.send({ type: "scan", code });
    await screen.nextMessage();
  };
  const closeAll = () => [printer, scanner, screen].forEach((connection) => connection.close());
  return { chart, nova, chore, printer, phone, ...printed, handIn, closeAll };
}

describe("push notifications", () => {
  test("a grown-up's subscribed phone is told when a child hands in a ticket", async () => {
    const { phone, handIn, closeAll } = await novaWithAPrintedChore();

    await handIn();

    // The screen hears first (a child shouldn't wait on a push service); the notification follows a moment later.
    await expect.poll(() => push.to(phone.endpoint)).toEqual([
      expect.objectContaining({ title: "Nova handed in a ticket", body: expect.stringContaining("Feed the cat") }),
    ]);
    closeAll();
  });
});

describe("who gets notified", () => {
  test("every subscribed device of every grown-up in the chart is told, and another chart's never are", async () => {
    const { chart, phone, handIn, closeAll } = await novaWithAPrintedChore();
    const ownersLaptop = fakeSubscription();
    await chart.owner.post("/api/push/subscriptions", ownersLaptop);
    const school = await chartWithObservatory(harness, "Room 12");
    const teachersPhone = fakeSubscription();
    await school.owner.post("/api/push/subscriptions", teachersPhone);

    await handIn();

    await expect.poll(() => push.to(ownersLaptop.endpoint).length).toBe(1);
    expect(push.to(phone.endpoint)).toHaveLength(1);
    expect(push.to(teachersPhone.endpoint)).toEqual([]);
    closeAll();
  });
});

describe("grouping hand-ins", () => {
  test("the first hand-in is sent straight away; more within a minute are sent together once it's passed", async () => {
    clock.set(new Date("2026-10-20T14:00:00Z"));
    const { chart, nova, phone, printer, handIn, closeAll } = await novaWithAPrintedChore();
    const more = await Promise.all(
      ["Make your bed", "Brush teeth"].map(async (title) => chart.print(nova, await chart.addChore(title, 1, [nova]), printer)),
    );

    await handIn();
    await expect.poll(() => push.to(phone.endpoint).length).toBe(1);
    clock.advanceBy(10_000);
    for (const ticket of more) await handIn(ticket.code);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const heldBack = push.to(phone.endpoint).length;
    clock.advanceBy(60_000);
    await harness.runScheduledJobs();

    expect(heldBack).toBe(1);
    expect(push.to(phone.endpoint).at(-1)).toMatchObject({ title: "2 more tickets handed in" });
    expect(push.to(phone.endpoint)).toHaveLength(2);
    closeAll();
  });
});

describe("lost tickets", () => {
  test("a child asking for a lost ticket again notifies the grown-ups", async () => {
    const { chart, nova, chore, phone, closeAll } = await novaWithAPrintedChore();

    await chart.screen.post(`/api/observatory/children/${nova}/reprint-requests`, { categoryId: chore.categoryId });

    await expect.poll(() => push.to(phone.endpoint)).toEqual([
      expect.objectContaining({ title: "Nova lost a ticket", body: expect.stringContaining("Feed the cat") }),
    ]);
    closeAll();
  });
});

describe("turning notifications off", () => {
  test("a device that unsubscribes isn't sent any more", async () => {
    const { chart, phone, handIn, closeAll } = await novaWithAPrintedChore();

    await chart.owner.delete("/api/push/subscriptions", { endpoint: phone.endpoint });
    await handIn();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(push.to(phone.endpoint)).toEqual([]);
    closeAll();
  });

  test("a device the push service says is gone is forgotten", async () => {
    const { chart, nova, phone, printer, handIn, closeAll } = await novaWithAPrintedChore();
    push.markGone(phone.endpoint);
    await handIn();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const another = await chart.print(nova, await chart.addChore("Make your bed", 1, [nova]), printer);
    clock.advanceBy(2 * 60_000);

    await handIn(another.code);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const subscriptions = (await chart.owner.get("/api/push/subscriptions")).body.subscriptions;
    expect(subscriptions).toEqual([]);
    closeAll();
  });
});
