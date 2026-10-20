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
});
