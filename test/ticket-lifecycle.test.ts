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

describe("one open ticket per category", () => {
  async function novaWithTwoChores() {
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const { category } = (await chart.owner.post("/api/categories", { name: "Chores", kind: "chore" })).body;
    const addChore = async (name: string) =>
      (await chart.owner.post("/api/chores", { categoryId: category.id, name, stars: 1, childIds: [nova] })).body.chore.id;
    const bed = await addChore("Make your bed");
    const cat = await addChore("Feed the cat");
    const printer = await chart.connectPrinter();
    const print = (choiceId: string) =>
      chart.screen.post(`/api/observatory/children/${nova}/tickets`, { categoryId: category.id, choiceId });
    return { chart, bed, cat, printer, print };
  }

  test("a child holding an open ticket in a category can't print another one there, and is told why", async () => {
    const { bed, cat, printer, print } = await novaWithTwoChores();
    await print(bed);

    const second = await print(cat);

    expect(second.status).toBe(409);
    expect(second.body.error).toMatch(/already/i);
    printer.close();
  });

  test("a handed-in ticket still counts as the child's open ticket in that category", async () => {
    const { chart, bed, cat, printer, print } = await novaWithTwoChores();
    await print(bed);
    const { code } = (await printer.nextMessage()).ticket;
    const scanner = await chart.connectScanner();
    const screen = await chart.connectScreen();
    scanner.send({ type: "scan", code });
    await screen.nextMessage();

    expect((await print(cat)).status).toBe(409);
    [printer, scanner, screen].forEach((connection) => connection.close());
  });

  test("once the ticket is approved, the child can print another one in that category", async () => {
    const { chart, bed, cat, printer, print } = await novaWithTwoChores();
    const first = (await print(bed)).body.ticket.id;
    await chart.owner.post(`/api/tickets/${first}/approve`, {});

    expect((await print(cat)).status).toBe(201);
    printer.close();
  });
});

describe("who did what", () => {
  test("a ticket's history records which grown-up rejected, then approved it", async () => {
    const { chart, ticketId, scan, closeAll } = await novaWithAPrintedChore();
    const { email } = (await chart.owner.get("/api/me")).body.grownUp;
    await scan();
    await chart.owner.post(`/api/tickets/${ticketId}/reject`, { note: "Try again" });
    await scan();
    await chart.owner.post(`/api/tickets/${ticketId}/approve`, { stars: 3 });

    const history = (await chart.owner.get(`/api/tickets/${ticketId}/history`)).body.history;

    expect(history).toEqual([
      { action: "rejected", by: email, note: "Try again", stars: null, at: expect.any(String) },
      { action: "approved", by: email, note: null, stars: 3, at: expect.any(String) },
    ]);
    closeAll();
  });

  test("a dismissal is recorded too", async () => {
    const { chart, ticketId, closeAll } = await novaWithAPrintedChore();
    const { email } = (await chart.owner.get("/api/me")).body.grownUp;
    await chart.owner.post(`/api/tickets/${ticketId}/dismiss`, {});

    const history = (await chart.owner.get(`/api/tickets/${ticketId}/history`)).body.history;

    expect(history).toEqual([{ action: "dismissed", by: email, note: null, stars: null, at: expect.any(String) }]);
    closeAll();
  });
});
