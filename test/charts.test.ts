import { describe, expect, test } from "vitest";
import { startTestApp, uniqueEmail } from "./support/test-app.js";

const { newClient } = await startTestApp();

describe("creating a chart", () => {
  test("a grown-up who signs up and creates a chart becomes its owner", async () => {
    const grownUp = newClient();
    const email = uniqueEmail("parent");

    const signUp = await grownUp.post("/api/sign-up", {
      email,
      password: "correct horse battery staple",
      chartName: "Our House",
      timeZone: "America/Chicago",
    });
    expect(signUp.status).toBe(201);

    const me = await grownUp.get("/api/me");
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      grownUp: { email, role: "owner" },
      chart: { name: "Our House", timeZone: "America/Chicago" },
    });
  });
});
