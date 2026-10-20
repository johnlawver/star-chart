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

describe("guessing PINs", () => {
  test("after 5 wrong PINs the observatory refuses every PIN, even the right one, for 5 minutes", async () => {
    clock.set(new Date("2026-10-20T15:00:00Z"));
    const { chart, unlock } = await ownerWithPin("2468");
    for (const guess of ["0000", "1111", "2222", "3333", "4444"]) await unlock(guess);

    const rightButLocked = await unlock("2468");
    clock.advanceBy(5 * 60 * 1000);
    const afterFiveMinutes = await unlock("2468");

    expect(rightButLocked.status).toBe(429);
    expect(afterFiveMinutes.status).toBe(200);
    expect((await chart.screen.get("/api/me")).status).toBe(200);
  });

  test("a right PIN before the limit clears the count of wrong ones", async () => {
    clock.set(new Date("2026-10-20T16:00:00Z"));
    const { unlock } = await ownerWithPin("2468");
    for (const guess of ["0000", "1111", "2222", "3333"]) await unlock(guess);
    await unlock("2468");

    for (const guess of ["0000", "1111", "2222", "3333"]) await unlock(guess);
    const stillAllowed = await unlock("2468");

    expect(stillAllowed.status).toBe(200);
  });
});

describe("an unlocked observatory locks itself again", () => {
  test("a Control Center unlocked on the observatory closes after 10 minutes, but a normal sign-in doesn't", async () => {
    clock.set(new Date("2026-10-20T17:00:00Z"));
    const { chart, unlock } = await ownerWithPin("2468");
    await unlock("2468");

    clock.advanceBy(10 * 60 * 1000 + 1000);

    expect((await chart.screen.get("/api/me")).status).toBe(401);
    expect((await chart.owner.get("/api/me")).status).toBe(200);
  });
});

describe("setting up a phone from the observatory", () => {
  test("the unlocked observatory makes a code that signs a phone in as that grown-up, once", async () => {
    const { chart, grownUp, unlock } = await ownerWithPin("2468");
    await unlock("2468");
    const { code } = (await chart.screen.post("/api/phone-setup")).body;
    const phone = harness.newClient();
    const someoneElsesPhone = harness.newClient();

    const claimed = await phone.post("/api/phone-setup/claim", { code });
    const claimedAgain = await someoneElsesPhone.post("/api/phone-setup/claim", { code });

    expect(claimed.status).toBe(200);
    expect((await phone.get("/api/me")).body.grownUp.email).toBe(grownUp.email);
    expect(claimedAgain.status).toBe(404);
    expect((await someoneElsesPhone.get("/api/me")).status).toBe(401);
  });

  test("a phone setup code stops working after 5 minutes", async () => {
    const { chart, unlock } = await ownerWithPin("2468");
    await unlock("2468");
    const { code } = (await chart.screen.post("/api/phone-setup")).body;

    clock.advanceBy(5 * 60 * 1000 + 1000);
    const tooLate = await harness.newClient().post("/api/phone-setup/claim", { code });

    expect(tooLate.status).toBe(404);
  });

  test("the phone's sign-in lasts, unlike the observatory's", async () => {
    const { chart, unlock } = await ownerWithPin("2468");
    await unlock("2468");
    const { code } = (await chart.screen.post("/api/phone-setup")).body;
    const phone = harness.newClient();
    await phone.post("/api/phone-setup/claim", { code });

    clock.advanceBy(24 * 60 * 60 * 1000);

    expect((await phone.get("/api/me")).status).toBe(200);
  });
});
