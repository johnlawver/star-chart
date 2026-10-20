import { describe, expect, test } from "vitest";
import { signUpOwner } from "./support/sign-up.js";
import { startTestApp } from "./support/test-app.js";

const { newClient, clock, openLiveConnection } = await startTestApp();

describe("pairing an observatory", () => {
  test("the owner signs in on a fresh observatory to pair it, and it then shows the chart's children", async () => {
    const owner = await signUpOwner(newClient());
    await owner.client.post("/api/children", { nickname: "Nova", displayStyle: "words" });
    await owner.client.post("/api/children", { nickname: "Pip", displayStyle: "pictures" });
    const screen = newClient();

    await screen.post("/api/sign-in", { email: owner.email, password: owner.password });
    const paired = await screen.post("/api/observatories");

    expect(paired.status).toBe(201);
    screen.useDeviceToken(paired.body.deviceToken);
    const children = (await screen.get("/api/observatory/children")).body.children;
    expect(children).toEqual([
      { id: expect.any(String), nickname: "Pip", displayStyle: "pictures" },
      { id: expect.any(String), nickname: "Nova", displayStyle: "words" },
    ]);
  });

  test("after pairing, the grown-up is signed out on the observatory, and it stays paired", async () => {
    const owner = await signUpOwner(newClient());
    const screen = newClient();
    await screen.post("/api/sign-in", { email: owner.email, password: owner.password });

    const { deviceToken } = (await screen.post("/api/observatories")).body;

    expect((await screen.get("/api/me")).status).toBe(401);
    const laterThatWeek = newClient();
    laterThatWeek.useDeviceToken(deviceToken);
    expect((await laterThatWeek.get("/api/observatory/children")).status).toBe(200);
  });
});

describe("pairing parts", () => {
  async function pairedObservatory() {
    const owner = await signUpOwner(newClient());
    const screen = newClient();
    await screen.post("/api/sign-in", { email: owner.email, password: owner.password });
    const paired = (await screen.post("/api/observatories")).body;
    screen.useDeviceToken(paired.deviceToken);
    await owner.client.post("/api/sign-in", { email: owner.email, password: owner.password });
    return { owner: owner.client, screen, observatoryId: paired.observatory.id as string };
  }

  test("a printer pairs to an observatory with the pairing code its screen shows", async () => {
    const { owner, screen, observatoryId } = await pairedObservatory();
    const { code } = (await screen.post("/api/observatory/pairing-codes")).body;
    const printer = newClient();

    const paired = await printer.post("/api/parts", { code, kind: "printer" });

    expect(paired.status).toBe(201);
    expect(paired.body.deviceToken).toEqual(expect.any(String));
    const observatories = (await owner.get("/api/observatories")).body.observatories;
    expect(observatories).toEqual([
      { id: observatoryId, parts: [{ kind: "printer" }, { kind: "screen" }] },
    ]);
  });

  test("a pairing code works only once", async () => {
    const { screen } = await pairedObservatory();
    const { code } = (await screen.post("/api/observatory/pairing-codes")).body;
    await newClient().post("/api/parts", { code, kind: "printer" });

    const secondUse = await newClient().post("/api/parts", { code, kind: "scanner" });

    expect(secondUse.status).toBe(404);
  });

  test("a pairing code stops working after 10 minutes", async () => {
    const { screen } = await pairedObservatory();
    const { code } = (await screen.post("/api/observatory/pairing-codes")).body;

    clock.advanceBy(10 * 60 * 1000 + 1);
    const tooLate = await newClient().post("/api/parts", { code, kind: "printer" });

    expect(tooLate.status).toBe(404);
  });
});

describe("live connections", () => {
  async function pairedPrinter() {
    const owner = await signUpOwner(newClient());
    const screen = newClient();
    await screen.post("/api/sign-in", { email: owner.email, password: owner.password });
    screen.useDeviceToken((await screen.post("/api/observatories")).body.deviceToken);
    const { code } = (await screen.post("/api/observatory/pairing-codes")).body;
    const { deviceToken } = (await newClient().post("/api/parts", { code, kind: "printer" })).body;
    return { owner, screen, deviceToken: deviceToken as string };
  }

  test("a paired printer connects out to the server and is welcomed", async () => {
    const { deviceToken } = await pairedPrinter();
    const printer = await openLiveConnection();

    printer.send({ type: "hello", deviceToken });

    expect(await printer.nextMessage()).toEqual({ type: "welcome", kind: "printer" });
    printer.close();
  });

  test("a connection with a credential the server doesn't recognise is closed", async () => {
    const impostor = await openLiveConnection();

    impostor.send({ type: "hello", deviceToken: "made-up" });

    expect(await impostor.closed).toEqual({ code: 4401 });
  });

  test("unpairing an observatory disconnects its parts and revokes every credential it had", async () => {
    const { owner, screen, deviceToken } = await pairedPrinter();
    const printer = await openLiveConnection();
    printer.send({ type: "hello", deviceToken });
    await printer.nextMessage();
    const [observatory] = (await owner.client.get("/api/observatories")).body.observatories;

    const unpaired = await owner.client.delete(`/api/observatories/${observatory.id}`);

    expect(unpaired.status).toBe(204);
    expect(await printer.closed).toEqual({ code: 4401 });
    expect((await screen.get("/api/observatory/children")).status).toBe(401);
    const reconnecting = await openLiveConnection();
    reconnecting.send({ type: "hello", deviceToken });
    expect(await reconnecting.closed).toEqual({ code: 4401 });
  });
});

describe("keeping charts and devices apart", () => {
  async function chartWithObservatory(chartName: string, childNickname: string) {
    const owner = await signUpOwner(newClient(), chartName);
    await owner.client.post("/api/children", { nickname: childNickname, displayStyle: "words" });
    const screen = newClient();
    await screen.post("/api/sign-in", { email: owner.email, password: owner.password });
    screen.useDeviceToken((await screen.post("/api/observatories")).body.deviceToken);
    return { owner: owner.client, screen };
  }

  test("an observatory only ever shows its own chart's children", async () => {
    const home = await chartWithObservatory("Our House", "Nova");
    const school = await chartWithObservatory("Room 12", "Ava");

    const homeNicknames = (await home.screen.get("/api/observatory/children")).body.children.map(
      (child: { nickname: string }) => child.nickname,
    );
    const schoolNicknames = (await school.screen.get("/api/observatory/children")).body.children.map(
      (child: { nickname: string }) => child.nickname,
    );

    expect(homeNicknames).toEqual(["Nova"]);
    expect(schoolNicknames).toEqual(["Ava"]);
  });

  test("a grown-up in another chart can't see or unpair our observatory", async () => {
    const home = await chartWithObservatory("Our House", "Nova");
    const school = await chartWithObservatory("Room 12", "Ava");
    const [homeObservatory] = (await home.owner.get("/api/observatories")).body.observatories;

    const schoolSees = (await school.owner.get("/api/observatories")).body.observatories;
    const unpaired = await school.owner.delete(`/api/observatories/${homeObservatory.id}`);

    expect(schoolSees.map((o: { id: string }) => o.id)).not.toContain(homeObservatory.id);
    expect(unpaired.status).toBe(404);
    expect((await home.screen.get("/api/observatory/children")).status).toBe(200);
  });

  test("a printer's credential can't be used to act as a screen", async () => {
    const { screen } = await chartWithObservatory("Our House", "Nova");
    const { code } = (await screen.post("/api/observatory/pairing-codes")).body;
    const printer = newClient();
    printer.useDeviceToken((await newClient().post("/api/parts", { code, kind: "printer" })).body.deviceToken);

    expect((await printer.get("/api/observatory/children")).status).toBe(401);
    expect((await printer.post("/api/observatory/pairing-codes")).status).toBe(401);
  });

  test("someone who isn't signed in can't pair or list observatories", async () => {
    const stranger = newClient();

    expect((await stranger.post("/api/observatories")).status).toBe(401);
    expect((await stranger.get("/api/observatories")).status).toBe(401);
  });
});
