import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

// A grown-up can make a pairing code from the Control Center (on their phone, say) for an observatory they choose,
// not only on an unlocked observatory screen. The phone setup page for a unit needs this.

const harness = await startTestApp();

async function chartAndObservatoryId() {
  const chart = await chartWithObservatory(harness);
  const [observatory] = (await chart.owner.get("/api/observatories")).body.observatories;
  return { chart, observatoryId: observatory.id as string };
}

describe("making a pairing code from the Control Center", () => {
  test("the owner gets a code for the observatory they chose, which pairs a part there once, for 10 minutes", async () => {
    const { chart, observatoryId } = await chartAndObservatoryId();

    const made = await chart.owner.post(`/api/observatories/${observatoryId}/pairing-codes`);
    const paired = await harness.newClient().post("/api/parts", { code: made.body.code, kind: "unit" });
    const again = await harness.newClient().post("/api/parts", { code: made.body.code, kind: "printer" });

    expect(made.status).toBe(201);
    expect(made.body).toEqual({ code: expect.stringMatching(/^[2-9A-HJ-NP-Z]{8}$/), expiresAt: "2026-10-20T08:10:00.000Z" });
    expect(paired.status).toBe(201);
    expect(again.status).toBe(404);
    const [observatory] = (await chart.owner.get("/api/observatories")).body.observatories;
    expect(observatory.parts.map((part: { kind: string }) => part.kind)).toEqual(["screen", "unit"]);
  });

  test("the code pairs to the chosen observatory, not another in the same chart", async () => {
    const { chart } = await chartAndObservatoryId();
    harness.clock.advanceBy(1000); // so the observatories list in the order they were paired
    await chart.pairAnotherScreen();
    const [, kitchen] = (await chart.owner.get("/api/observatories")).body.observatories;

    const { code } = (await chart.owner.post(`/api/observatories/${kitchen.id}/pairing-codes`)).body;
    await harness.newClient().post("/api/parts", { code, kind: "printer" });

    const [first, second] = (await chart.owner.get("/api/observatories")).body.observatories;
    expect(first.parts.map((part: { kind: string }) => part.kind)).toEqual(["screen"]);
    expect(second.parts.map((part: { kind: string }) => part.kind)).toEqual(["printer", "screen"]);
  });

  test("grown-ups who aren't the owner or an admin are refused", async () => {
    const { chart, observatoryId } = await chartAndObservatoryId();
    const partner = await chart.inviteGrownUp();

    expect((await partner.post(`/api/observatories/${observatoryId}/pairing-codes`)).status).toBe(403);
  });

  test("an observatory in another chart, or one that doesn't exist, is not found; signed out is 401", async () => {
    const { observatoryId } = await chartAndObservatoryId();
    const school = await chartWithObservatory(harness, "Room 12");

    expect((await school.owner.post(`/api/observatories/${observatoryId}/pairing-codes`)).status).toBe(404);
    expect((await school.owner.post("/api/observatories/not-an-id/pairing-codes")).status).toBe(404);
    expect((await harness.newClient().post(`/api/observatories/${observatoryId}/pairing-codes`)).status).toBe(401);
  });

  test("one grown-up can make at most 20 codes an hour", async () => {
    const { chart, observatoryId } = await chartAndObservatoryId();

    const statuses = [];
    for (let i = 0; i < 21; i++) statuses.push((await chart.owner.post(`/api/observatories/${observatoryId}/pairing-codes`)).status);

    expect(statuses.slice(0, 20).every((status) => status === 201)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});
