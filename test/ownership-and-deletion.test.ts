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

describe("leaving a chart", () => {
  test("the owner can't leave until they've handed the chart over", async () => {
    const { owner, roleOf } = await aChartOfThree();

    const left = await owner.client.delete("/api/me");

    expect(left.status).toBe(409);
    expect(await roleOf(owner.client)).toBe("owner");
  });

  test("anyone else can leave, which deletes their login", async () => {
    const { admin } = await aChartOfThree();

    const left = await admin.client.delete("/api/me");
    const signInAgain = await harness.newClient().post("/api/sign-in", { email: admin.email, password: "a good long password" });

    expect(left.status).toBe(204);
    expect((await admin.client.get("/api/me")).status).toBe(401);
    expect(signInAgain.status).toBe(401);
  });
});

describe("removing grown-ups", () => {
  test("the owner can remove an admin or a grown-up, who are signed out at once", async () => {
    const { owner, admin, grownUp } = await aChartOfThree();

    const removedAdmin = await owner.client.delete(`/api/grown-ups/${admin.id}`);
    const removedGrownUp = await owner.client.delete(`/api/grown-ups/${grownUp.id}`);

    expect([removedAdmin.status, removedGrownUp.status]).toEqual([204, 204]);
    expect((await admin.client.get("/api/me")).status).toBe(401);
    expect((await grownUp.client.get("/api/me")).status).toBe(401);
  });

  test("an admin can remove grown-ups, but not other admins or the owner; grown-ups can't remove anyone", async () => {
    const { owner, admin, grownUp } = await aChartOfThree();
    const secondAdmin = await (async () => {
      const email = uniqueEmail("admin");
      await owner.client.post("/api/invitations", { email });
      const token = FakeMailer.linkParameter(harness.mailer.lastTo(email)!, "token");
      const client = harness.newClient();
      await client.post("/api/invitations/accept", { token, password: "a good long password" });
      const id = (await client.get("/api/me")).body.grownUp.id;
      await owner.client.patch(`/api/grown-ups/${id}`, { role: "admin" });
      return id;
    })();

    const statuses = [
      (await grownUp.client.delete(`/api/grown-ups/${admin.id}`)).status,
      (await admin.client.delete(`/api/grown-ups/${secondAdmin}`)).status,
      (await admin.client.delete(`/api/grown-ups/${owner.id}`)).status,
      (await owner.client.delete(`/api/grown-ups/${owner.id}`)).status,
      (await admin.client.delete(`/api/grown-ups/${grownUp.id}`)).status,
    ];

    expect(statuses).toEqual([403, 403, 403, 409, 204]);
  });

  test("a removed grown-up's past decisions show as by a former grown-up", async () => {
    const { chartWithObservatory } = await import("./support/observatory.js");
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const printer = await chart.connectPrinter();
    const { ticketId } = await chart.print(nova, await chart.addChore("Feed the cat", 2, [nova]), printer);
    const email = uniqueEmail("babysitter");
    await chart.owner.post("/api/invitations", { email });
    const helper = harness.newClient();
    await helper.post("/api/invitations/accept", {
      token: FakeMailer.linkParameter(harness.mailer.lastTo(email)!, "token"),
      password: "a good long password",
    });
    await helper.post(`/api/tickets/${ticketId}/approve`, {});
    const helperId = (await helper.get("/api/me")).body.grownUp.id;

    await chart.owner.delete(`/api/grown-ups/${helperId}`);

    const history = (await chart.owner.get(`/api/tickets/${ticketId}/history`)).body.history;
    expect(history).toEqual([expect.objectContaining({ action: "approved", by: "a former grown-up" })]);
    printer.close();
  });
});

describe("deleting a child", () => {
  test("deleting a child permanently removes everything about them, and leaves other children alone", async () => {
    const { chartWithObservatory } = await import("./support/observatory.js");
    const { rowsStillPointingAt } = await import("./support/database.js");
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const pip = await chart.addChild("Pip", "pictures");
    const printer = await chart.connectPrinter();
    const scanner = await chart.connectScanner();
    const screen = await chart.connectScreen();
    const approved = await chart.print(nova, await chart.addChore("Feed the cat", 5, [nova]), printer);
    await chart.owner.post(`/api/tickets/${approved.ticketId}/approve`, {});
    await chart.owner.post(`/api/children/${nova}/redemptions`, { amount: 2, note: "Sticker" });
    const stillOpen = await chart.print(nova, await chart.addChore("Make your bed", 1, [nova, pip]), printer);
    await chart.screen.post(`/api/observatory/children/${nova}/reprint-requests`, { kind: "chore" });
    const pipsTicket = await chart.print(pip, await chart.addChore("Tidy toys", 1, [pip]), printer);
    await chart.owner.post(`/api/tickets/${pipsTicket.ticketId}/approve`, {});

    const deleted = await chart.owner.delete(`/api/children/${nova}`);

    expect(deleted.status).toBe(204);
    scanner.send({ type: "scan", code: stillOpen.code });
    expect(await screen.nextMessage()).toEqual({ type: "scan-result", result: "not-recognised" });
    expect((await chart.owner.get("/api/reprint-requests")).body.reprintRequests).toEqual([]);
    expect((await chart.owner.get(`/api/children/${nova}/constellation`)).status).toBe(404);
    expect(await rowsStillPointingAt("child_id", [nova])).toEqual({});
    expect(await rowsStillPointingAt("ticket_id", [approved.ticketId, stillOpen.ticketId])).toEqual({});
    expect((await chart.owner.get(`/api/children/${pip}/constellation`)).body.balance).toBe(1);
    [printer, scanner, screen].forEach((connection) => connection.close());
  });
});

describe("deleting a chart", () => {
  test("only the owner can delete the chart, and only by typing its name", async () => {
    const { owner, admin } = await aChartOfThree("Our House");

    const byAdmin = await admin.client.delete("/api/chart", { confirmName: "Our House" });
    const wrongName = await owner.client.delete("/api/chart", { confirmName: "Our Hose" });

    expect([byAdmin.status, wrongName.status]).toEqual([403, 400]);
    expect((await owner.client.get("/api/me")).status).toBe(200);
  });

  test("deleting the chart removes all of it, disconnects its devices, and leaves other charts alone", async () => {
    const { chartWithObservatory } = await import("./support/observatory.js");
    const { rowsStillPointingAt } = await import("./support/database.js");
    const home = await chartWithObservatory(harness, "Our House");
    const nova = await home.addChild("Nova");
    const printer = await home.connectPrinter();
    const { ticketId } = await home.print(nova, await home.addChore("Feed the cat", 2, [nova]), printer);
    await home.owner.post(`/api/tickets/${ticketId}/approve`, {});
    const homeChartId = (await home.owner.get("/api/me")).body.chart.id;
    const school = await chartWithObservatory(harness, "Room 12");
    await school.addChild("Ava");

    const deleted = await home.owner.delete("/api/chart", { confirmName: "Our House" });

    expect(deleted.status).toBe(204);
    expect((await home.owner.get("/api/me")).status).toBe(401);
    expect((await home.screen.get("/api/observatory/children")).status).toBe(401);
    expect(await printer.closed).toEqual({ code: 4401 });
    expect(await rowsStillPointingAt("chart_id", [homeChartId])).toEqual({});
    expect(await rowsStillPointingAt("child_id", [nova])).toEqual({});
    expect((await school.owner.get("/api/children")).body.children.map((c: { nickname: string }) => c.nickname)).toEqual(["Ava"]);
  });
});

describe("keeping charts apart", () => {
  test("an owner of another chart can't remove our grown-ups or be handed our chart", async () => {
    const home = await aChartOfThree("Our House");
    const school = await aChartOfThree("Room 12");

    const removed = await school.owner.client.delete(`/api/grown-ups/${home.grownUp.id}`);
    const handedToOurs = await school.owner.client.post("/api/ownership", { grownUpId: home.admin.id });

    expect([removed.status, handedToOurs.status]).toEqual([404, 404]);
    expect((await home.grownUp.client.get("/api/me")).status).toBe(200);
  });
});
