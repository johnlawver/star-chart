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

  test("an email address already used in a chart can't sign up for another chart, whatever its case", async () => {
    const email = uniqueEmail("parent");
    const details = { password: "correct horse battery staple", chartName: "Our House", timeZone: "America/Chicago" };
    await newClient().post("/api/sign-up", { email, ...details });

    const secondSignUp = await newClient().post("/api/sign-up", { email: email.toUpperCase(), ...details });

    expect(secondSignUp.status).toBe(409);
  });

  test("a chart's time zone must be a real time zone", async () => {
    const signUp = await newClient().post("/api/sign-up", {
      email: uniqueEmail("parent"),
      password: "correct horse battery staple",
      chartName: "Our House",
      timeZone: "Mars/Olympus_Mons",
    });

    expect(signUp.status).toBe(400);
  });
});

describe("keeping charts apart", () => {
  test("grown-ups in different charts each see only their own chart", async () => {
    const details = { password: "correct horse battery staple", timeZone: "America/Chicago" };
    const homeParent = newClient();
    const teacher = newClient();
    await homeParent.post("/api/sign-up", { email: uniqueEmail("parent"), chartName: "Our House", ...details });
    await teacher.post("/api/sign-up", { email: uniqueEmail("teacher"), chartName: "Room 12", ...details });

    const homeChart = (await homeParent.get("/api/me")).body.chart;
    const classChart = (await teacher.get("/api/me")).body.chart;

    expect(homeChart.name).toBe("Our House");
    expect(classChart.name).toBe("Room 12");
    expect(homeChart.id).not.toBe(classChart.id);
  });
});

describe("signing in and out", () => {
  async function signUpNewOwner() {
    const email = uniqueEmail("parent");
    const password = "correct horse battery staple";
    await newClient().post("/api/sign-up", { email, password, chartName: "Our House", timeZone: "America/Chicago" });
    return { email, password };
  }

  test("a grown-up who signs out is no longer signed in", async () => {
    const grownUp = newClient();
    await grownUp.post("/api/sign-up", {
      email: uniqueEmail("parent"),
      password: "correct horse battery staple",
      chartName: "Our House",
      timeZone: "America/Chicago",
    });

    await grownUp.post("/api/sign-out");

    expect((await grownUp.get("/api/me")).status).toBe(401);
  });

  test("a grown-up can sign in again with their email and password", async () => {
    const { email, password } = await signUpNewOwner();
    const laterVisit = newClient();

    const signIn = await laterVisit.post("/api/sign-in", { email, password });

    expect(signIn.status).toBe(200);
    expect((await laterVisit.get("/api/me")).body).toMatchObject({ grownUp: { email, role: "owner" } });
  });

  test("signing in with the wrong password is refused", async () => {
    const { email } = await signUpNewOwner();
    const stranger = newClient();

    const signIn = await stranger.post("/api/sign-in", { email, password: "not the password" });

    expect(signIn.status).toBe(401);
    expect((await stranger.get("/api/me")).status).toBe(401);
  });
});
