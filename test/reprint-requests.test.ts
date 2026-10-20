import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();

/** Nova holds an open chore ticket, printed on the observatory's printer. */
async function novaWithAnOpenTicket() {
  const chart = await chartWithObservatory(harness);
  const nova = await chart.addChild("Nova");
  const chore = await chart.addChore("Feed the cat", 2, [nova]);
  const printer = await chart.connectPrinter();
  const printed = await chart.print(nova, chore, printer);
  const ask = () => chart.screen.post(`/api/observatory/children/${nova}/reprint-requests`, { categoryId: chore.categoryId });
  const pending = async () => (await chart.owner.get("/api/reprint-requests")).body.reprintRequests;
  return { chart, nova, chore, printer, ...printed, ask, pending };
}

describe("reprint requests", () => {
  test("a child asks for a lost ticket again, and once a grown-up approves, the same ticket prints", async () => {
    const { chart, printer, ticketId, code, ask, pending } = await novaWithAnOpenTicket();

    const asked = await ask();
    const [request] = await pending();
    const approved = await chart.owner.post(`/api/reprint-requests/${request.id}/approve`, {});

    expect(asked.status).toBe(201);
    expect(request).toMatchObject({ childNickname: "Nova", title: "Feed the cat" });
    expect(approved.status).toBe(200);
    expect((await printer.nextMessage()).ticket).toMatchObject({ id: ticketId, code, title: "Feed the cat", stars: 2 });
    expect(await pending()).toEqual([]);
    printer.close();
  });
});
