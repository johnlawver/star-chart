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
  const ask = () => chart.screen.post(`/api/observatory/children/${nova}/reprint-requests`, { kind: "chore" });
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

  test("a declined request prints nothing", async () => {
    const { chart, printer, ask, pending } = await novaWithAnOpenTicket();
    await ask();
    const [request] = await pending();

    const declined = await chart.owner.post(`/api/reprint-requests/${request.id}/decline`, {});

    expect(declined.status).toBe(204);
    expect(await pending()).toEqual([]);
    await expect(printer.nextMessage()).rejects.toThrow(/no message/);
    printer.close();
  });

  test("a child can only ask for a ticket they hold, and only once until a grown-up answers", async () => {
    const { chart, nova, printer, ask } = await novaWithAnOpenTicket();

    // Nova holds a chore ticket, but no quiz ticket.
    const nothingToReprint = await chart.screen.post(`/api/observatory/children/${nova}/reprint-requests`, { kind: "quiz" });
    const first = await ask();
    const again = await ask();

    expect(nothingToReprint.status).toBe(404);
    expect(first.status).toBe(201);
    expect(again.status).toBe(409);
    printer.close();
  });

  test("if the printer is offline when a grown-up approves, the request waits, and prints once it's back", async () => {
    const { chart, printer, code, ask, pending } = await novaWithAnOpenTicket();
    await ask();
    const [request] = await pending();
    printer.close();
    await expect
      .poll(async () => (await chart.owner.get("/api/observatories")).body.observatories[0].parts)
      .toContainEqual({ kind: "printer", online: false });

    const whileOffline = await chart.owner.post(`/api/reprint-requests/${request.id}/approve`, {});
    const stillWaiting = await pending();
    const printerBack = await chart.connectPrinter();
    const onceBack = await chart.owner.post(`/api/reprint-requests/${request.id}/approve`, {});

    expect(whileOffline.status).toBe(503);
    expect(stillWaiting.map((r: { id: string }) => r.id)).toEqual([request.id]);
    expect(onceBack.status).toBe(200);
    expect((await printerBack.nextMessage()).ticket.code).toBe(code);
    printerBack.close();
  });

  test("if the ticket was finished in the meantime, approving the request closes it and prints nothing", async () => {
    const { chart, printer, ticketId, ask, pending } = await novaWithAnOpenTicket();
    await ask();
    const [request] = await pending();
    await chart.owner.post(`/api/tickets/${ticketId}/approve`, {});

    const approved = await chart.owner.post(`/api/reprint-requests/${request.id}/approve`, {});

    expect(approved.status).toBe(409);
    expect(await pending()).toEqual([]);
    await expect(printer.nextMessage()).rejects.toThrow(/no message/);
    printer.close();
  });
});

describe("keeping charts apart", () => {
  test("another chart can't see, approve or decline our requests, or ask on our child's behalf", async () => {
    const { nova, chore, printer, ask, pending } = await novaWithAnOpenTicket();
    await ask();
    const [request] = await pending();
    const school = await chartWithObservatory(harness, "Room 12");

    const theirList = (await school.owner.get("/api/reprint-requests")).body.reprintRequests;
    const approved = await school.owner.post(`/api/reprint-requests/${request.id}/approve`, {});
    const declined = await school.owner.post(`/api/reprint-requests/${request.id}/decline`, {});
    const askedForUs = await school.screen.post(`/api/observatory/children/${nova}/reprint-requests`, { kind: "chore" });

    expect(theirList).toEqual([]);
    expect([approved.status, declined.status, askedForUs.status]).toEqual([404, 404, 404]);
    expect((await pending()).map((r: { id: string }) => r.id)).toEqual([request.id]);
    printer.close();
  });
});
