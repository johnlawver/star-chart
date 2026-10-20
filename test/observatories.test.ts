import { describe, expect, test } from "vitest";
import { signUpOwner } from "./support/sign-up.js";
import { startTestApp } from "./support/test-app.js";

const { newClient } = await startTestApp();

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
});
