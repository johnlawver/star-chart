import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();
const { clock } = harness;

/** Nova has handed in a chore; a grown-up has made a Guest PIN; the observatory's screen is ready. */
async function aBabysittingEvening() {
  const chart = await chartWithObservatory(harness);
  const nova = await chart.addChild("Nova");
  const chore = await chart.addChore("Brush teeth", 1, [nova]);
  const printer = await chart.connectPrinter();
  const scanner = await chart.connectScanner();
  const screen = await chart.connectScreen();
  const printed = await chart.print(nova, chore, printer);
  scanner.send({ type: "scan", code: printed.code });
  await screen.nextMessage();
  const made = await chart.owner.post("/api/guest-pins", { label: "Saturday sitter" });
  /** The babysitter enters the Guest PIN on the observatory's screen. */
  const unlockAsGuest = (pin: string = made.body.pin) => chart.screen.post("/api/observatory/unlock-guest", { pin });
  const closeAll = () => [printer, scanner, screen].forEach((connection) => connection.close());
  return { chart, nova, chore, printer, made, ...printed, unlockAsGuest, closeAll };
}

describe("guest PINs", () => {
  test("a grown-up makes a Guest PIN; a guest uses it on the observatory to approve a ticket, recorded as by a guest", async () => {
    clock.set(new Date("2026-10-21T22:00:00Z"));
    const { chart, made, ticketId, unlockAsGuest, closeAll } = await aBabysittingEvening();

    const unlocked = await unlockAsGuest();
    const waiting = (await chart.screen.get("/api/tickets?state=handed-in")).body.tickets;
    const approved = await chart.screen.post(`/api/tickets/${ticketId}/approve`, {});

    expect(made.status).toBe(201);
    expect(made.body).toEqual({ id: expect.any(String), pin: expect.stringMatching(/^[0-9]{6}$/), expiresAt: "2026-10-22T10:00:00.000Z" });
    expect(unlocked.status).toBe(200);
    expect(waiting.map((ticket: { id: string }) => ticket.id)).toEqual([ticketId]);
    expect(approved.status).toBe(200);
    const history = (await chart.owner.get(`/api/tickets/${ticketId}/history`)).body.history;
    expect(history).toEqual([expect.objectContaining({ action: "approved", by: "a guest" })]);
    closeAll();
  });
});

describe("how long a Guest PIN works", () => {
  test("a Guest PIN stops working after 12 hours by default", async () => {
    clock.set(new Date("2026-10-21T22:00:00Z"));
    const { unlockAsGuest, closeAll } = await aBabysittingEvening();

    clock.advanceBy(12 * 60 * 60 * 1000 + 1000);

    expect((await unlockAsGuest()).status).toBe(401);
    closeAll();
  });

  test("a grown-up can choose how many hours it lasts", async () => {
    clock.set(new Date("2026-10-21T22:00:00Z"));
    const { chart, closeAll } = await aBabysittingEvening();
    const { pin } = (await chart.owner.post("/api/guest-pins", { hours: 3 })).body;

    clock.advanceBy(3 * 60 * 60 * 1000 - 60_000);
    const justBefore = await chart.screen.post("/api/observatory/unlock-guest", { pin });
    clock.advanceBy(2 * 60_000);
    const justAfter = await chart.screen.post("/api/observatory/unlock-guest", { pin });

    expect([justBefore.status, justAfter.status]).toEqual([200, 401]);
    closeAll();
  });

  test("cancelling a Guest PIN stops it working, and ends the guest's session there and then", async () => {
    const { chart, made, ticketId, unlockAsGuest, closeAll } = await aBabysittingEvening();
    await unlockAsGuest();

    const cancelled = await chart.owner.delete(`/api/guest-pins/${made.body.id}`);

    expect(cancelled.status).toBe(204);
    expect((await chart.screen.post(`/api/tickets/${ticketId}/approve`, {})).status).toBe(401);
    expect((await unlockAsGuest()).status).toBe(401);
    expect((await chart.owner.get("/api/guest-pins")).body.guestPins).toEqual([]);
    closeAll();
  });

  test("a guest's session on the observatory ends after 10 minutes, like a grown-up's", async () => {
    clock.set(new Date("2026-10-21T22:00:00Z"));
    const { chart, unlockAsGuest, closeAll } = await aBabysittingEvening();
    await unlockAsGuest();

    clock.advanceBy(10 * 60 * 1000 + 1000);

    expect((await chart.screen.get("/api/tickets?state=handed-in")).status).toBe(401);
    closeAll();
  });
});

describe("what a guest can do", () => {
  test("a guest can reject and dismiss tickets too", async () => {
    const { chart, ticketId, unlockAsGuest, closeAll } = await aBabysittingEvening();
    await unlockAsGuest();

    const rejected = await chart.screen.post(`/api/tickets/${ticketId}/reject`, { note: "Teeth first!" });
    const dismissed = await chart.screen.post(`/api/tickets/${ticketId}/dismiss`, {});

    expect([rejected.status, dismissed.status]).toEqual([200, 200]);
    const history = (await chart.owner.get(`/api/tickets/${ticketId}/history`)).body.history;
    expect(history.map((event: { by: string }) => event.by)).toEqual(["a guest", "a guest"]);
    closeAll();
  });

  test("a guest is refused everything except handling tickets", async () => {
    const { chart, nova, chore, unlockAsGuest, closeAll } = await aBabysittingEvening();
    await unlockAsGuest();

    const statuses = [
      (await chart.screen.post("/api/children", { nickname: "Sneaky", displayStyle: "words" })).status,
      (await chart.screen.post("/api/categories", { name: "Sneaky", kind: "chore" })).status,
      (await chart.screen.post("/api/chores", { categoryId: chore.categoryId, name: "Sneaky", stars: 100, childIds: [nova] })).status,
      (await chart.screen.post(`/api/children/${nova}/redemptions`, { amount: 1, note: "Sneaky" })).status,
      (await chart.screen.post("/api/invitations", { email: "sneaky@example.test" })).status,
      (await chart.screen.post("/api/guest-pins", {})).status,
      (await chart.screen.put("/api/me/pin", { pin: "1234" })).status,
      (await chart.screen.post("/api/observatory/pairing-codes")).status,
      (await chart.screen.get("/api/grown-ups")).status,
    ];

    expect(statuses).toEqual([403, 403, 403, 403, 403, 403, 403, 403, 403]);
    closeAll();
  });

  test("a guest can answer a lost-ticket request, and the same ticket prints again", async () => {
    const { chart, nova, printer, unlockAsGuest, closeAll } = await aBabysittingEvening();
    const lost = await chart.print(nova, await chart.addChore("Feed the cat", 1, [nova]), printer);
    await chart.screen.post(`/api/observatory/children/${nova}/reprint-requests`, {
      categoryId: (await chart.owner.get("/api/categories")).body.categories.find((c: any) => c.chores[0].name === "Feed the cat").id,
    });
    await unlockAsGuest();

    const [request] = (await chart.screen.get("/api/reprint-requests")).body.reprintRequests;
    const approved = await chart.screen.post(`/api/reprint-requests/${request.id}/approve`, {});

    expect(approved.status).toBe(200);
    expect((await printer.nextMessage()).ticket.code).toBe(lost.code);
    closeAll();
  });

  test("any grown-up can make a Guest PIN, not just the owner and admins", async () => {
    const { FakeMailer } = await import("./support/fake-mailer.js");
    const { uniqueEmail } = await import("./support/test-app.js");
    const chart = await chartWithObservatory(harness);
    const email = uniqueEmail("grown-up");
    await chart.owner.post("/api/invitations", { email });
    const grownUp = harness.newClient();
    await grownUp.post("/api/invitations/accept", {
      token: FakeMailer.linkParameter(harness.mailer.lastTo(email)!, "token"),
      password: "a good long password",
    });

    expect((await grownUp.post("/api/guest-pins", {})).status).toBe(201);
  });
});

describe("guessing Guest PINs", () => {
  test("wrong Guest PINs count towards the observatory's lockout", async () => {
    clock.set(new Date("2026-10-21T22:00:00Z"));
    const { unlockAsGuest, closeAll } = await aBabysittingEvening();
    for (const guess of ["000000", "111111", "222222", "333333", "444444"]) await unlockAsGuest(guess);

    expect((await unlockAsGuest()).status).toBe(429);
    closeAll();
  });
});

describe("keeping charts apart", () => {
  test("a Guest PIN only works on its own chart's observatories, and only on its own chart's tickets", async () => {
    const home = await aBabysittingEvening();
    const school = await aBabysittingEvening();

    const ourPinOnTheirScreen = await school.chart.screen.post("/api/observatory/unlock-guest", { pin: home.made.body.pin });
    await home.unlockAsGuest();
    const ourGuestOnTheirTicket = await home.chart.screen.post(`/api/tickets/${school.ticketId}/approve`, {});

    expect(ourPinOnTheirScreen.status).toBe(401);
    expect(ourGuestOnTheirTicket.status).toBe(404);
    home.closeAll();
    school.closeAll();
  });
});
