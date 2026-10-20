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

/** A chart with its owner and one invited grown-up who has accepted. */
async function ownerAndPartner() {
  const owner = await signUpOwner(harness.newClient());
  const { token, email } = await invite(owner.client);
  const partner = harness.newClient();
  await partner.post("/api/invitations/accept", { token, password: "a good long password" });
  const grownUps: { id: string; email: string; role: string }[] = (await owner.client.get("/api/grown-ups")).body.grownUps;
  const partnerId = grownUps.find((grownUp) => grownUp.email === email)!.id;
  const ownerId = grownUps.find((grownUp) => grownUp.role === "owner")!.id;
  return { owner: owner.client, partner, partnerId, ownerId, grownUps };
}

describe("roles", () => {
  test("grown-ups can see who's in their chart and what role each has", async () => {
    const { grownUps } = await ownerAndPartner();

    expect(grownUps.map((grownUp) => grownUp.role).sort()).toEqual(["grown-up", "owner"]);
  });

  test("the owner can make a grown-up an admin, and back again", async () => {
    const { owner, partner, partnerId } = await ownerAndPartner();

    const promoted = await owner.patch(`/api/grown-ups/${partnerId}`, { role: "admin" });
    const asAdmin = (await partner.get("/api/me")).body.grownUp.role;
    const demoted = await owner.patch(`/api/grown-ups/${partnerId}`, { role: "grown-up" });

    expect([promoted.status, demoted.status]).toEqual([200, 200]);
    expect(asAdmin).toBe("admin");
    expect((await partner.get("/api/me")).body.grownUp.role).toBe("grown-up");
  });

  test("only the owner changes roles: an admin or a grown-up can't", async () => {
    const { owner, partner, partnerId, ownerId } = await ownerAndPartner();
    const { token } = await invite(owner);
    const third = harness.newClient();
    await third.post("/api/invitations/accept", { token, password: "a good long password" });
    await owner.patch(`/api/grown-ups/${partnerId}`, { role: "admin" });
    const thirdId = (await third.get("/api/me")).body.grownUp.id;

    const byAdmin = await partner.patch(`/api/grown-ups/${thirdId}`, { role: "admin" });
    const byGrownUp = await third.patch(`/api/grown-ups/${partnerId}`, { role: "grown-up" });
    const adminOnOwner = await partner.patch(`/api/grown-ups/${ownerId}`, { role: "grown-up" });

    expect([byAdmin.status, byGrownUp.status, adminOnOwner.status]).toEqual([403, 403, 403]);
  });

  test("the owner's own role can't be changed this way (ownership is handed over instead)", async () => {
    const { owner, ownerId } = await ownerAndPartner();

    const changed = await owner.patch(`/api/grown-ups/${ownerId}`, { role: "admin" });

    expect(changed.status).toBe(409);
    expect((await owner.get("/api/me")).body.grownUp.role).toBe("owner");
  });

  test("admins can invite grown-ups, but grown-ups can't", async () => {
    const { owner, partner, partnerId } = await ownerAndPartner();
    const asGrownUp = await partner.post("/api/invitations", { email: uniqueEmail("friend") });
    await owner.patch(`/api/grown-ups/${partnerId}`, { role: "admin" });

    const asAdmin = await partner.post("/api/invitations", { email: uniqueEmail("friend") });

    expect(asGrownUp.status).toBe(403);
    expect(asAdmin.status).toBe(201);
  });
});
