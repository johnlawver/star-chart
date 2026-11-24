import { expect, test } from "vitest";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();

test("a health check says the server is up and can reach its database, without signing in", async () => {
  const response = await harness.newClient().get("/api/health");

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ ok: true });
});
