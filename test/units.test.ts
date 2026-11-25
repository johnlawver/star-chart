import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

// A unit is one box that is both an observatory's printer and its scanner (CONTEXT.md). It pairs once, with one
// credential and one live connection, and does both jobs.

const harness = await startTestApp();

describe("pairing a unit", () => {
  test("pairing as a unit gives one credential, and the observatory lists one part that prints and scans", async () => {
    const chart = await chartWithObservatory(harness);
    const code = await chart.pairingCode();

    const paired = await harness.newClient().post("/api/parts", { code, kind: "unit" });
    const [observatory] = (await chart.owner.get("/api/observatories")).body.observatories;

    expect(paired.status).toBe(201);
    expect(paired.body).toEqual({ deviceToken: expect.any(String) });
    expect(observatory.parts).toEqual([
      { kind: "screen", online: false },
      { kind: "unit", online: false },
    ]);
  });

  test("its live connection is welcomed as a unit", async () => {
    const chart = await chartWithObservatory(harness);
    const code = await chart.pairingCode();
    const { deviceToken } = (await harness.newClient().post("/api/parts", { code, kind: "unit" })).body;
    const connection = await harness.openLiveConnection();

    connection.send({ type: "hello", deviceToken });

    expect(await connection.nextMessage()).toEqual({ type: "welcome", kind: "unit" });
    connection.close();
  });
});

describe("a unit at work", () => {
  test("a child's ticket prints on the unit, and scanning it there hands it in and tells both the unit and the screen", async () => {
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const chore = await chart.addChore("Feed the cat", 2, [nova]);
    const unit = await chart.connectUnit();
    const screen = await chart.connectScreen();
    const { code } = await chart.print(nova, chore, unit);

    unit.send({ type: "scan", code });

    const result = { type: "scan-result", result: "handed-in", childNickname: "Nova", title: "Feed the cat" };
    expect(await screen.nextMessage()).toEqual(result);
    expect(await unit.nextMessage()).toEqual(result);
    expect((await chart.owner.get("/api/tickets?state=handed-in")).body.tickets).toHaveLength(1);
    unit.close();
    screen.close();
  });

  test("the screen sees its printer and scanner online while the unit is connected, and both offline when it drops", async () => {
    const chart = await chartWithObservatory(harness);
    const unit = await chart.connectUnit();

    const connected = (await chart.screen.get("/api/observatory/parts")).body;
    unit.close();

    expect(connected).toEqual({ printer: "online", scanner: "online" });
    await expect.poll(async () => (await chart.screen.get("/api/observatory/parts")).body).toEqual({ printer: "offline", scanner: "offline" });
  });

  test("with the unit gone, printing is refused as the printer being offline", async () => {
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const chore = await chart.addChore("Feed the cat", 2, [nova]);
    const unit = await chart.connectUnit();
    unit.close();
    await expect.poll(async () => (await chart.screen.get("/api/observatory/parts")).body.printer).toBe("offline");

    const printed = await chart.screen.post(`/api/observatory/children/${nova}/tickets`, { kind: "chore", taskId: chore.choreId });

    expect(printed.status).toBe(503);
    expect(printed.body).toMatchObject({ reason: "printer-offline" });
  });
});

describe("unpairing", () => {
  test("unpairing the observatory disconnects the unit and its credential stops working, for both jobs", async () => {
    const chart = await chartWithObservatory(harness);
    const code = await chart.pairingCode();
    const { deviceToken } = (await harness.newClient().post("/api/parts", { code, kind: "unit" })).body;
    const unit = await harness.openLiveConnection();
    unit.send({ type: "hello", deviceToken });
    await unit.nextMessage();
    const [observatory] = (await chart.owner.get("/api/observatories")).body.observatories;

    await chart.owner.delete(`/api/observatories/${observatory.id}`);
    const again = await harness.openLiveConnection();
    again.send({ type: "hello", deviceToken });

    expect(await unit.closed).toEqual({ code: 4401 });
    expect(await again.closed).toEqual({ code: 4401 });
  });
});
