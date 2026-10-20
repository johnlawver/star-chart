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
