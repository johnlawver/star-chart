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
