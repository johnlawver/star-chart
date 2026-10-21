import { describe, expect, test } from "vitest";
import { FakeMailer } from "./support/fake-mailer.js";
import { signUpOwner } from "./support/sign-up.js";
import { startTestApp, uniqueEmail, type ApiClient } from "./support/test-app.js";

const harness = await startTestApp();

/** A chart with its owner, an admin and a plain grown-up, each signed in on their own client. */
async function aChartOfThree(chartName = "Our House") {
  const owner = await signUpOwner(harness.newClient(), chartName);
  const join = async (role: "admin" | "grown-up") => {
    const email = uniqueEmail(role);
    await owner.client.post("/api/invitations", { email });
    const token = FakeMailer.linkParameter(harness.mailer.lastTo(email)!, "token");
    const client = harness.newClient();
    await client.post("/api/invitations/accept", { token, password: "a good long password" });
    const id: string = (await client.get("/api/me")).body.grownUp.id;
    if (role === "admin") await owner.client.patch(`/api/grown-ups/${id}`, { role });
    return { client, id, email };
  };
  const admin = await join("admin");
  const grownUp = await join("grown-up");
  const ownerId: string = (await owner.client.get("/api/me")).body.grownUp.id;
  const roleOf = async (client: ApiClient) => (await client.get("/api/me")).body.grownUp?.role;
  return { owner: { ...owner, id: ownerId }, admin, grownUp, roleOf };
}

describe("handing over ownership", () => {
  test("the owner hands the chart to an admin, and becomes an admin", async () => {
    const { owner, admin, roleOf } = await aChartOfThree();

    const handed = await owner.client.post("/api/ownership", { grownUpId: admin.id });

    expect(handed.status).toBe(200);
    expect(await roleOf(admin.client)).toBe("owner");
    expect(await roleOf(owner.client)).toBe("admin");
  });

  test("ownership only goes to an admin, and only the owner can hand it over", async () => {
    const { owner, admin, grownUp, roleOf } = await aChartOfThree();

    const toGrownUp = await owner.client.post("/api/ownership", { grownUpId: grownUp.id });
    const byAdmin = await admin.client.post("/api/ownership", { grownUpId: admin.id });

    expect([toGrownUp.status, byAdmin.status]).toEqual([409, 403]);
    expect(await roleOf(owner.client)).toBe("owner");
  });
});
