import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { signUpOwner } from "./support/sign-up.js";
import { startTestApp } from "./support/test-app.js";

// A fresh observatory screen shows a QR (a public code); a grown-up scans it on their phone and approves; the screen,
// which kept a secret of its own, then collects its credential. (.scratch/easy-install/issues/01)

const harness = await startTestApp();

async function freshScreen() {
  const screen = harness.newClient();
  const made = await screen.post("/api/screen-setups");
  const collect = () => screen.post("/api/screen-setups/collect", { secret: made.body.secret });
  return { screen, made, collect };
}

describe("setting up a screen from a phone", () => {
  test("a fresh screen gets a short code to show and a secret to keep, for 10 minutes", async () => {
    const { made, collect } = await freshScreen();

    expect(made.status).toBe(201);
    expect(made.body).toEqual({
      code: expect.stringMatching(/^[2-9A-HJ-NP-Z]{8}$/),
      secret: expect.stringMatching(/^[\w-]{40,}$/),
      expiresAt: "2026-10-20T08:10:00.000Z",
      link: `https://star-chart.test/connect-screen.html#c=${made.body.code}`,
      qr: expect.stringMatching(/^<svg[^>]*>.*<\/svg>\s*$/s),
    });
    expect((await collect()).body).toEqual({ waiting: true });
  });

  test("the QR comes drawn by the server, as plain SVG paths, because the frame's old browser can't draw one", async () => {
    const { made } = await freshScreen();

    expect(made.body.qr).toContain("<path");
    expect(made.body.qr).not.toMatch(/<script|<image|<foreignObject|href=/i);
  });

  test("once the owner approves the code, the screen collects a credential for a new observatory in their chart, once", async () => {
    const owner = await signUpOwner(harness.newClient());
    const { screen, made, collect } = await freshScreen();

    const approved = await owner.client.post("/api/screen-setups/approve", { code: made.body.code });
    const collected = await collect();
    const again = await collect();

    expect(approved.status).toBe(200);
    expect(collected.status).toBe(201);
    expect(collected.body).toEqual({ deviceToken: expect.any(String) });
    expect(again.status).toBe(404);
    screen.useDeviceToken(collected.body.deviceToken);
    expect((await screen.get("/api/observatory/children")).status).toBe(200);
    const { observatories } = (await owner.client.get("/api/observatories")).body;
    expect(observatories).toHaveLength(1);
    expect(observatories[0].parts.map((part: { kind: string }) => part.kind)).toEqual(["screen"]);
  });

  test("the approving phone stays signed in (unlike signing in on the screen itself)", async () => {
    const owner = await signUpOwner(harness.newClient());
    const { made } = await freshScreen();

    await owner.client.post("/api/screen-setups/approve", { code: made.body.code });

    expect((await owner.client.get("/api/me")).status).toBe(200);
  });

  test("an admin of a chart with an observatory can add another screen this way", async () => {
    const chart = await chartWithObservatory(harness);
    const { made, collect } = await freshScreen();

    await chart.owner.post("/api/screen-setups/approve", { code: made.body.code });
    await collect();

    expect((await chart.owner.get("/api/observatories")).body.observatories).toHaveLength(2);
  });

  test("grown-ups who aren't the owner or an admin can't approve, and the code still works for someone who can", async () => {
    const chart = await chartWithObservatory(harness);
    const partner = await chart.inviteGrownUp();
    const { made, collect } = await freshScreen();

    const refused = await partner.post("/api/screen-setups/approve", { code: made.body.code });
    const byOwner = await chart.owner.post("/api/screen-setups/approve", { code: made.body.code });

    expect(refused.status).toBe(403);
    expect(byOwner.status).toBe(200);
    expect((await collect()).status).toBe(201);
  });

  test("signed out, approving is 401", async () => {
    const { made } = await freshScreen();

    expect((await harness.newClient().post("/api/screen-setups/approve", { code: made.body.code })).status).toBe(401);
  });

  test("a wrong code, or one already approved, is not found", async () => {
    const owner = await signUpOwner(harness.newClient());
    const school = await signUpOwner(harness.newClient(), "Room 12");
    const { made, collect } = await freshScreen();

    await owner.client.post("/api/screen-setups/approve", { code: made.body.code });
    const second = await school.client.post("/api/screen-setups/approve", { code: made.body.code });
    const wrong = await owner.client.post("/api/screen-setups/approve", { code: "ZZZZZZZZ" });
    await collect();

    expect(second.status).toBe(404);
    expect(wrong.status).toBe(404);
    expect((await owner.client.get("/api/observatories")).body.observatories).toHaveLength(1);
    expect((await school.client.get("/api/observatories")).body.observatories).toHaveLength(0);
  });

  test("codes are read without regard to case or spaces, as someone might type one", async () => {
    const owner = await signUpOwner(harness.newClient());
    const { made, collect } = await freshScreen();
    const typed = `${made.body.code.slice(0, 4)} ${made.body.code.slice(4)}`.toLowerCase();

    expect((await owner.client.post("/api/screen-setups/approve", { code: typed })).status).toBe(200);
    expect((await collect()).status).toBe(201);
  });

  test("knowing the code isn't enough to collect: only the screen's own secret works", async () => {
    const owner = await signUpOwner(harness.newClient());
    const { made } = await freshScreen();
    await owner.client.post("/api/screen-setups/approve", { code: made.body.code });

    const bystander = await harness.newClient().post("/api/screen-setups/collect", { secret: made.body.code });

    expect(bystander.status).toBe(404);
  });

  test("after 10 minutes the code can't be approved and the screen is told to start again", async () => {
    const owner = await signUpOwner(harness.newClient());
    const { made, collect } = await freshScreen();

    harness.clock.advanceBy(10 * 60 * 1000);

    expect((await owner.client.post("/api/screen-setups/approve", { code: made.body.code })).status).toBe(404);
    expect((await collect()).status).toBe(404);
  });

  test("a screen approved just before its code ran out still has a few minutes to collect", async () => {
    const owner = await signUpOwner(harness.newClient());
    const { made, collect } = await freshScreen();

    harness.clock.advanceBy(9 * 60 * 1000 + 59_000);
    await owner.client.post("/api/screen-setups/approve", { code: made.body.code });
    harness.clock.advanceBy(60_000);

    expect((await collect()).status).toBe(201);
  });

  test("wrong codes count towards the address's limit on wrong codes", async () => {
    const owner = await signUpOwner(harness.newClient());

    const statuses = [];
    for (let i = 0; i < 21; i++) statuses.push((await owner.client.post("/api/screen-setups/approve", { code: "ZZZZZZZZ" })).status);

    expect(statuses.slice(0, 20).every((status) => status === 404)).toBe(true);
    expect(statuses[20]).toBe(429);
  });

  test("one address can start at most 30 setups an hour", async () => {
    const screen = harness.newClient();

    const statuses = [];
    for (let i = 0; i < 31; i++) statuses.push((await screen.post("/api/screen-setups")).status);

    expect(statuses.slice(0, 30).every((status) => status === 201)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  test("unexpected fields are refused", async () => {
    const owner = await signUpOwner(harness.newClient());
    const { made } = await freshScreen();

    expect((await owner.client.post("/api/screen-setups/approve", { code: made.body.code, chartId: "x" })).status).toBe(400);
    expect((await harness.newClient().post("/api/screen-setups/collect", { secret: made.body.secret, extra: 1 })).status).toBe(400);
  });
});
