import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();

/** A chart where Nova has one chore ticket printed, with the observatory's printer, scanner and screen connected. */
async function novaWithAPrintedChore(stars = 2) {
  const chart = await chartWithObservatory(harness);
  const nova = await chart.addChild("Nova");
  const chore = await chart.addChore("Feed the cat", stars, [nova]);
  const printer = await chart.connectPrinter();
  const scanner = await chart.connectScanner();
  const screen = await chart.connectScreen();
  const printed = await chart.print(nova, chore, printer);
  const scan = async (code = printed.code) => {
    scanner.send({ type: "scan", code });
    return screen.nextMessage();
  };
  const balance = async () => (await chart.screen.get(`/api/observatory/children/${nova}`)).body.child.balance;
  const ticketsIn = async (state: string) =>
    (await chart.owner.get(`/api/tickets?state=${state}`)).body.tickets.map((t: { id: string }) => t.id);
  const closeAll = () => [printer, scanner, screen].forEach((connection) => connection.close());
  return { chart, nova, chore, printer, ...printed, scan, balance, ticketsIn, closeAll };
}

describe("rejecting a ticket", () => {
  test("a rejected ticket goes back to open with the grown-up's note, and earns no stars", async () => {
    const { chart, ticketId, scan, balance, ticketsIn, closeAll } = await novaWithAPrintedChore();
    await scan();

    const rejected = await chart.owner.post(`/api/tickets/${ticketId}/reject`, { note: "The bowl is still empty!" });

    expect(rejected.status).toBe(200);
    expect(rejected.body.ticket).toMatchObject({ id: ticketId, state: "open", note: "The bowl is still empty!" });
    expect(await ticketsIn("open")).toContain(ticketId);
    expect(await balance()).toBe(0);
    closeAll();
  });
});

describe("dismissing a ticket", () => {
  test("a grown-up can dismiss an open ticket, and it earns no stars", async () => {
    const { chart, ticketId, balance, ticketsIn, closeAll } = await novaWithAPrintedChore();

    const dismissed = await chart.owner.post(`/api/tickets/${ticketId}/dismiss`, {});

    expect(dismissed.status).toBe(200);
    expect(dismissed.body.ticket).toMatchObject({ id: ticketId, state: "dismissed" });
    expect(await ticketsIn("dismissed")).toEqual([ticketId]);
    expect(await ticketsIn("open")).toEqual([]);
    expect(await balance()).toBe(0);
    closeAll();
  });

  test("a grown-up can dismiss a handed-in ticket too", async () => {
    const { chart, ticketId, scan, ticketsIn, closeAll } = await novaWithAPrintedChore();
    await scan();

    const dismissed = await chart.owner.post(`/api/tickets/${ticketId}/dismiss`, {});

    expect(dismissed.status).toBe(200);
    expect(await ticketsIn("handed-in")).toEqual([]);
    expect(await ticketsIn("dismissed")).toEqual([ticketId]);
    closeAll();
  });
});
