import { describe, expect, test } from "vitest";
import { signUpAsOwner } from "./support/sign-up.js";
import { startTestApp } from "./support/test-app.js";

const { newClient } = await startTestApp();

describe("children", () => {
  test("a grown-up can add children by nickname with a display style, and see them listed", async () => {
    const grownUp = await signUpAsOwner(newClient());

    const added = await grownUp.post("/api/children", { nickname: "Nova", displayStyle: "words" });
    await grownUp.post("/api/children", { nickname: "Pip", displayStyle: "pictures" });

    expect(added.status).toBe(201);
    const children = (await grownUp.get("/api/children")).body.children;
    expect(children).toEqual([
      { id: expect.any(String), nickname: "Pip", displayStyle: "pictures" },
      { id: expect.any(String), nickname: "Nova", displayStyle: "words" },
    ]);
  });

  test("a grown-up can rename a child and switch their display style", async () => {
    const grownUp = await signUpAsOwner(newClient());
    const { child } = (await grownUp.post("/api/children", { nickname: "Pip", displayStyle: "pictures" })).body;

    const changed = await grownUp.patch(`/api/children/${child.id}`, { nickname: "Pipsqueak", displayStyle: "words" });

    expect(changed.status).toBe(200);
    expect((await grownUp.get("/api/children")).body.children).toEqual([
      { id: child.id, nickname: "Pipsqueak", displayStyle: "words" },
    ]);
  });

  test("a grown-up can remove a child", async () => {
    const grownUp = await signUpAsOwner(newClient());
    const { child } = (await grownUp.post("/api/children", { nickname: "Nova", displayStyle: "words" })).body;
    await grownUp.post("/api/children", { nickname: "Pip", displayStyle: "pictures" });

    const removed = await grownUp.delete(`/api/children/${child.id}`);

    expect(removed.status).toBe(204);
    const nicknames = (await grownUp.get("/api/children")).body.children.map((c: { nickname: string }) => c.nickname);
    expect(nicknames).toEqual(["Pip"]);
  });
});
