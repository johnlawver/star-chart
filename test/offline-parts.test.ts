import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();

describe("printing when the printer is offline", () => {
  test("with no printer connected, printing is refused with a reason, no ticket is made, and nothing prints later", async () => {
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const chore = await chart.addChore("Feed the cat", 2, [nova]);

    const printed = await chart.screen.post(`/api/observatory/children/${nova}/tickets`, {
      kind: "chore",
      taskId: chore.choreId,
    });

    expect(printed.status).toBe(503);
    expect(printed.body).toMatchObject({ reason: "printer-offline" });
    expect((await chart.owner.get("/api/tickets?state=open")).body.tickets).toEqual([]);
    const printerComingOnline = await chart.connectPrinter();
    await expect(printerComingOnline.nextMessage()).rejects.toThrow(/no message/);
    printerComingOnline.close();
  });
});

describe("parts' online status", () => {
  test("grown-ups see which of an observatory's parts are online", async () => {
    const chart = await chartWithObservatory(harness);
    const printer = await chart.connectPrinter();
    const code = await chart.pairingCode();
    await harness.newClient().post("/api/parts", { code, kind: "scanner" }); // paired, but never connects
    const screen = await chart.connectScreen();

    const [observatory] = (await chart.owner.get("/api/observatories")).body.observatories;

    expect(observatory.parts).toEqual([
      { kind: "printer", online: true },
      { kind: "scanner", online: false },
      { kind: "screen", online: true },
    ]);
    printer.close();
    screen.close();
  });

  test("a part that disconnects shows as offline, and printing is refused again", async () => {
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const chore = await chart.addChore("Feed the cat", 2, [nova]);
    const printer = await chart.connectPrinter();

    printer.close();

    await expect
      .poll(async () => (await chart.owner.get("/api/observatories")).body.observatories[0].parts)
      .toContainEqual({ kind: "printer", online: false });
    const printed = await chart.screen.post(`/api/observatory/children/${nova}/tickets`, {
      kind: "chore",
      taskId: chore.choreId,
    });
    expect(printed.status).toBe(503);
  });
});

describe("what the observatory screen knows about its own parts", () => {
  test("the screen can tell whether its printer and scanner are online, offline or not paired", async () => {
    const chart = await chartWithObservatory(harness);
    const printer = await chart.connectPrinter();
    const before = (await chart.screen.get("/api/observatory/parts")).body;
    const code = await chart.pairingCode();
    await harness.newClient().post("/api/parts", { code, kind: "scanner" });

    const after = (await chart.screen.get("/api/observatory/parts")).body;

    expect(before).toEqual({ printer: "online", scanner: "not-paired" });
    expect(after).toEqual({ printer: "online", scanner: "offline" });
    printer.close();
  });
});
