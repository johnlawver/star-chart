import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();

describe("handing in a ticket", () => {
  test("scanning a chore ticket hands it in, the screen says it's waiting for a grown-up, and grown-ups see it", async () => {
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const chore = await chart.addChore("Feed the cat", 2, [nova]);
    const printer = await chart.connectPrinter();
    const scanner = await chart.connectScanner();
    const screen = await chart.connectScreen();
    const { ticketId, code } = await chart.print(nova, chore, printer);

    scanner.send({ type: "scan", code });

    expect(await screen.nextMessage()).toEqual({
      type: "scan-result",
      result: "handed-in",
      childNickname: "Nova",
      title: "Feed the cat",
    });
    const waiting = (await chart.owner.get("/api/tickets?state=handed-in")).body.tickets;
    expect(waiting).toEqual([
      { id: ticketId, childId: nova, childNickname: "Nova", title: "Feed the cat", stars: 2, state: "handed-in" },
    ]);
    for (const connection of [printer, scanner, screen]) connection.close();
  });
});

describe("approving a ticket", () => {
  async function handedInChore(stars = 2) {
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const chore = await chart.addChore("Feed the cat", stars, [nova]);
    const printer = await chart.connectPrinter();
    const scanner = await chart.connectScanner();
    const screen = await chart.connectScreen();
    const printed = await chart.print(nova, chore, printer);
    scanner.send({ type: "scan", code: printed.code });
    await screen.nextMessage();
    for (const connection of [printer, scanner, screen]) connection.close();
    return { chart, nova, ticketId: printed.ticketId };
  }

  const balanceOf = async (chart: Awaited<ReturnType<typeof handedInChore>>["chart"], childId: string) =>
    (await chart.screen.get(`/api/observatory/children/${childId}`)).body.child.balance;

  test("approving a handed-in ticket awards its stars, and the child's balance goes up on the observatory", async () => {
    const { chart, nova, ticketId } = await handedInChore(2);
    expect(await balanceOf(chart, nova)).toBe(0);

    const approved = await chart.owner.post(`/api/tickets/${ticketId}/approve`, {});

    expect(approved.status).toBe(200);
    expect(approved.body.ticket).toMatchObject({ id: ticketId, state: "approved", stars: 2 });
    expect(await balanceOf(chart, nova)).toBe(2);
    expect((await chart.owner.get("/api/tickets?state=handed-in")).body.tickets).toEqual([]);
  });

  test("a grown-up can override the stars when approving, and the balance adds up every approval", async () => {
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const feedTheCat = await chart.addChore("Feed the cat", 2, [nova]);
    const tidyRoom = await chart.addChore("Tidy your room", 3, [nova]);
    const printer = await chart.connectPrinter();
    const scanner = await chart.connectScanner();
    const screen = await chart.connectScreen();
    const handIn = async (chore: { categoryId: string; choreId: string }) => {
      const printed = await chart.print(nova, chore, printer);
      scanner.send({ type: "scan", code: printed.code });
      await screen.nextMessage();
      return printed.ticketId;
    };
    const cat = await handIn(feedTheCat);
    const room = await handIn(tidyRoom);

    await chart.owner.post(`/api/tickets/${cat}/approve`, {});
    const bonus = await chart.owner.post(`/api/tickets/${room}/approve`, { stars: 5 });

    expect(bonus.body.ticket.stars).toBe(5);
    expect(await balanceOf(chart, nova)).toBe(7);
    for (const connection of [printer, scanner, screen]) connection.close();
  });
});
