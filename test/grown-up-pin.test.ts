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
});
