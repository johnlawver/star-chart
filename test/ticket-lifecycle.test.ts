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

describe("approving without a hand-in", () => {
  test("a grown-up can approve an open ticket that was never scanned", async () => {
    const { chart, ticketId, balance, closeAll } = await novaWithAPrintedChore(2);

    const approved = await chart.owner.post(`/api/tickets/${ticketId}/approve`, {});

    expect(approved.status).toBe(200);
    expect(approved.body.ticket).toMatchObject({ id: ticketId, state: "approved", stars: 2 });
    expect(await balance()).toBe(2);
    closeAll();
  });
});

describe("approved and dismissed are final", () => {
  test("an approved ticket can't be approved again, rejected or dismissed, and its stars count once", async () => {
    const { chart, ticketId, balance, closeAll } = await novaWithAPrintedChore(2);
    await chart.owner.post(`/api/tickets/${ticketId}/approve`, {});

    const again = await chart.owner.post(`/api/tickets/${ticketId}/approve`, {});
    const rejected = await chart.owner.post(`/api/tickets/${ticketId}/reject`, {});
    const dismissed = await chart.owner.post(`/api/tickets/${ticketId}/dismiss`, {});

    expect([again.status, rejected.status, dismissed.status]).toEqual([409, 409, 409]);
    expect(await balance()).toBe(2);
    closeAll();
  });

  test("a dismissed ticket can't be approved", async () => {
    const { chart, ticketId, balance, closeAll } = await novaWithAPrintedChore(2);
    await chart.owner.post(`/api/tickets/${ticketId}/dismiss`, {});

    const approved = await chart.owner.post(`/api/tickets/${ticketId}/approve`, {});

    expect(approved.status).toBe(409);
    expect(await balance()).toBe(0);
    closeAll();
  });

  test("a ticket that hasn't been handed in can't be rejected", async () => {
    const { chart, ticketId, closeAll } = await novaWithAPrintedChore();

    const rejected = await chart.owner.post(`/api/tickets/${ticketId}/reject`, {});

    expect(rejected.status).toBe(409);
    closeAll();
  });

  test("a ticket that doesn't exist is not found", async () => {
    const { chart, closeAll } = await novaWithAPrintedChore();

    const approved = await chart.owner.post("/api/tickets/00000000-0000-4000-8000-000000000000/approve", {});

    expect(approved.status).toBe(404);
    closeAll();
  });
});

describe("every scan result", () => {
  test("scanning a ticket that's already handed in says it's waiting for a grown-up", async () => {
    const { scan, closeAll } = await novaWithAPrintedChore();
    await scan();

    expect(await scan()).toEqual({
      type: "scan-result",
      result: "waiting-for-grown-up",
      childNickname: "Nova",
      title: "Feed the cat",
    });
    closeAll();
  });

  test("scanning a ticket with nothing left to hand in says it's already done", async () => {
    const { chart, ticketId, scan, closeAll } = await novaWithAPrintedChore();
    await chart.owner.post(`/api/tickets/${ticketId}/approve`, {});

    expect(await scan()).toEqual({
      type: "scan-result",
      result: "already-done",
      childNickname: "Nova",
      title: "Feed the cat",
    });
    closeAll();
  });

  test("scanning a code nobody printed isn't recognised", async () => {
    const { scan, closeAll } = await novaWithAPrintedChore();

    expect(await scan("SC-NOTAREALCODE")).toEqual({ type: "scan-result", result: "not-recognised" });
    closeAll();
  });
});
