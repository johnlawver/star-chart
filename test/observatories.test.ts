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
