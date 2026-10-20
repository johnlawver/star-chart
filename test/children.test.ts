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

describe("keeping as little as possible about children", () => {
  test("a child can't be given any personal details beyond a nickname and display style", async () => {
    const grownUp = await signUpAsOwner(newClient());

    const added = await grownUp.post("/api/children", {
      nickname: "Nova",
      displayStyle: "words",
      birthday: "2020-04-01",
      lastName: "Smith",
    });

    expect(added.status).toBe(400);
    expect((await grownUp.get("/api/children")).body.children).toEqual([]);
  });

  test("a display style must be pictures or words", async () => {
    const grownUp = await signUpAsOwner(newClient());

    const added = await grownUp.post("/api/children", { nickname: "Nova", displayStyle: "braille" });

    expect(added.status).toBe(400);
  });

  test("a child needs a nickname", async () => {
    const grownUp = await signUpAsOwner(newClient());

    const added = await grownUp.post("/api/children", { nickname: "  ", displayStyle: "words" });

    expect(added.status).toBe(400);
  });
});

describe("keeping charts apart", () => {
  async function twoCharts() {
    const parent = await signUpAsOwner(newClient(), "Our House");
    const teacher = await signUpAsOwner(newClient(), "Room 12");
    const { child } = (await parent.post("/api/children", { nickname: "Nova", displayStyle: "words" })).body;
    return { parent, teacher, child };
  }

  test("a grown-up in another chart doesn't see our children", async () => {
    const { teacher } = await twoCharts();

    expect((await teacher.get("/api/children")).body.children).toEqual([]);
  });

  test("a grown-up in another chart can't change or remove our child", async () => {
    const { parent, teacher, child } = await twoCharts();

    const changed = await teacher.patch(`/api/children/${child.id}`, { nickname: "Hacked" });
    const removed = await teacher.delete(`/api/children/${child.id}`);

    expect(changed.status).toBe(404);
    expect(removed.status).toBe(404);
    expect((await parent.get("/api/children")).body.children).toEqual([
      { id: child.id, nickname: "Nova", displayStyle: "words" },
    ]);
  });

  test("an unknown child id is simply not found", async () => {
    const grownUp = await signUpAsOwner(newClient());

    expect((await grownUp.patch("/api/children/not-a-real-id", { nickname: "X" })).status).toBe(404);
    expect((await grownUp.delete("/api/children/not-a-real-id")).status).toBe(404);
  });

  test("someone who isn't signed in can't see or add children", async () => {
    const stranger = newClient();

    expect((await stranger.get("/api/children")).status).toBe(401);
    expect((await stranger.post("/api/children", { nickname: "Nova", displayStyle: "words" })).status).toBe(401);
  });
});
