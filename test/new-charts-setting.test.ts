import { expect, test } from "vitest";
import { startTestApp, uniqueEmail } from "./support/test-app.js";

const { newClient } = await startTestApp({ allowNewCharts: false });

test("when new charts are turned off, signing up can't create a chart", async () => {
  const stranger = newClient();

  const signUp = await stranger.post("/api/sign-up", {
    email: uniqueEmail("stranger"),
    password: "correct horse battery staple",
    chartName: "Not Welcome Here",
    timeZone: "America/Chicago",
  });

  expect(signUp.status).toBe(403);
  expect((await stranger.get("/api/me")).status).toBe(401);
});
