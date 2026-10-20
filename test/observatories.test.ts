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
});
