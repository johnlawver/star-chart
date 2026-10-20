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

  test("spending more stars than the child has is refused, and the balance is unchanged", async () => {
    const { earn, redeem, balance, printer } = await novaWithStars();
    await earn("Feed the cat", 2);

    const tooMuch = await redeem(3, "A new bike");

    expect(tooMuch.status).toBe(409);
    expect(tooMuch.body.balance).toBe(2);
    expect(await balance()).toBe(2);
    printer.close();
  });

  test("grown-ups spending at the same moment can't take a balance below zero", async () => {
    const { earn, redeem, balance, printer } = await novaWithStars();
    await earn("Feed the cat", 5);

    // Ten one-star treats recorded all at once, against a balance of five.
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => redeem(1, `Sticker ${i + 1}`)));

    expect(results.filter((result) => result.status === 201)).toHaveLength(5);
    expect(results.filter((result) => result.status === 409)).toHaveLength(5);
    expect(await balance()).toBe(0);
    printer.close();
  });
});
