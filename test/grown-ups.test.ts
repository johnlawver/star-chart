import { describe, expect, test } from "vitest";
import { FakeMailer } from "./support/fake-mailer.js";
import { signUpOwner } from "./support/sign-up.js";
import { startTestApp, uniqueEmail } from "./support/test-app.js";

const harness = await startTestApp();
const { mailer, clock } = harness;

/** An owner invites someone; returns the invitation's token from the email they received. */
async function invite(inviter: ReturnType<typeof harness.newClient>, email = uniqueEmail("partner")) {
  const sent = await inviter.post("/api/invitations", { email });
  const message = mailer.lastTo(email);
  return { sent, email, token: message ? FakeMailer.linkParameter(message, "token") : undefined, message };
}

describe("invitations", () => {
  test("an owner invites someone by email, and accepting signs them in to the owner's chart", async () => {
    const owner = await signUpOwner(harness.newClient(), "Our House");
    await owner.client.post("/api/children", { nickname: "Nova", displayStyle: "words" });

    const { sent, email, token, message } = await invite(owner.client);
    const partner = harness.newClient();
    const accepted = await partner.post("/api/invitations/accept", { token, password: "a good long password" });

    expect(sent.status).toBe(201);
    expect(message?.subject).toMatch(/Our House/);
    expect(message?.text).toContain("https://star-chart.test/accept-invitation.html#token=");
    expect(accepted.status).toBe(200);
    expect((await partner.get("/api/me")).body).toMatchObject({ grownUp: { email, role: "grown-up" }, chart: { name: "Our House" } });
    expect((await partner.get("/api/children")).body.children.map((c: { nickname: string }) => c.nickname)).toEqual(["Nova"]);
  });
});

describe("invitation links", () => {
  test("an invitation works only once", async () => {
    const owner = await signUpOwner(harness.newClient());
    const { token } = await invite(owner.client);
    await harness.newClient().post("/api/invitations/accept", { token, password: "a good long password" });

    const again = await harness.newClient().post("/api/invitations/accept", { token, password: "another password" });

    expect(again.status).toBe(404);
  });

  test("an invitation expires after 7 days", async () => {
    const owner = await signUpOwner(harness.newClient());
    const { token } = await invite(owner.client);

    clock.advanceBy(7 * 24 * 60 * 60 * 1000 + 1000);
    const tooLate = await harness.newClient().post("/api/invitations/accept", { token, password: "a good long password" });

    expect(tooLate.status).toBe(404);
  });

  test("an email that already belongs to a chart can't accept an invitation to another", async () => {
    const home = await signUpOwner(harness.newClient(), "Our House");
    const school = await signUpOwner(harness.newClient(), "Room 12");
    const { token } = await invite(school.client, home.email);

    const accepted = await harness.newClient().post("/api/invitations/accept", { token, password: "a good long password" });

    expect(accepted.status).toBe(409);
  });

  test("a password must be at least 8 characters", async () => {
    const owner = await signUpOwner(harness.newClient());
    const { token } = await invite(owner.client);

    const accepted = await harness.newClient().post("/api/invitations/accept", { token, password: "short" });

    expect(accepted.status).toBe(400);
  });
});
