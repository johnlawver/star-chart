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
