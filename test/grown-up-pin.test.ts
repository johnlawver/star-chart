import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();
const { clock } = harness;

/** A chart whose owner has set a Grown-up PIN, with its observatory screen. */
async function ownerWithPin(pin = "2468") {
  const chart = await chartWithObservatory(harness);
  await chart.owner.put("/api/me/pin", { pin });
  const { grownUp } = (await chart.owner.get("/api/me")).body;
  const [listed] = (await chart.screen.get("/api/observatory/grown-ups")).body.grownUps;
  const unlock = (enteredPin: string, grownUpId: string = listed.id) =>
    chart.screen.post("/api/observatory/unlock", { grownUpId, pin: enteredPin });
  return { chart, grownUp, listed, unlock };
}

describe("unlocking the Control Center on the observatory", () => {
  test("a grown-up taps themselves and enters their PIN, and the observatory then acts as them", async () => {
    const { chart, grownUp, listed, unlock } = await ownerWithPin("2468");
    expect(listed).toEqual({ id: expect.any(String), name: grownUp.email.split("@")[0] });

    const unlocked = await unlock("2468");

    expect(unlocked.status).toBe(200);
    expect((await chart.screen.get("/api/me")).body.grownUp).toMatchObject({ email: grownUp.email, role: "owner" });
  });

  test("a wrong PIN is refused, and the observatory stays locked", async () => {
    const { chart, unlock } = await ownerWithPin("2468");

    const wrong = await unlock("1357");

    expect(wrong.status).toBe(401);
    expect((await chart.screen.get("/api/me")).status).toBe(401);
  });

  test("grown-ups who haven't set a PIN aren't offered, and can't unlock", async () => {
    const chart = await chartWithObservatory(harness);
    const { grownUp } = (await chart.owner.get("/api/me")).body;

    const offered = (await chart.screen.get("/api/observatory/grown-ups")).body.grownUps;
    const tried = await chart.screen.post("/api/observatory/unlock", { grownUpId: grownUp.id, pin: "0000" });

    expect(offered).toEqual([]);
    expect(tried.status).toBe(401);
  });

  test("a PIN must be 4 to 8 digits", async () => {
    const chart = await chartWithObservatory(harness);

    const statuses = await Promise.all(
      ["123", "123456789", "12ab", ""].map(async (pin) => (await chart.owner.put("/api/me/pin", { pin })).status),
    );

    expect(statuses).toEqual([400, 400, 400, 400]);
  });
});
