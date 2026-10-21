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
