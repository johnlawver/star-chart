import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();

/** Nova in a fresh chart, plus a way to earn stars by doing a chore that a grown-up approves. */
async function novaWithStars() {
  const chart = await chartWithObservatory(harness);
  const nova = await chart.addChild("Nova");
  const printer = await chart.connectPrinter();
  const earn = async (title: string, stars: number) => {
    harness.clock.advanceBy(60_000);
    const chore = await chart.addChore(title, stars, [nova]);
    const { ticketId } = await chart.print(nova, chore, printer);
    await chart.owner.post(`/api/tickets/${ticketId}/approve`, {});
  };
  const redeem = (amount: number, note: string) => {
    harness.clock.advanceBy(60_000);
    return chart.owner.post(`/api/children/${nova}/redemptions`, { amount, note });
  };
  const balance = async () => (await chart.screen.get(`/api/observatory/children/${nova}`)).body.child.balance;
  return { chart, nova, printer, earn, redeem, balance };
}

describe("redemptions", () => {
  test("a grown-up records what a child spent their stars on, and the balance goes down", async () => {
    const { earn, redeem, balance, printer } = await novaWithStars();
    await earn("Feed the cat", 5);

    const spent = await redeem(3, "Ice cream");

    expect(spent.status).toBe(201);
    expect(spent.body.balance).toBe(2);
    expect(await balance()).toBe(2);
    printer.close();
  });
});
