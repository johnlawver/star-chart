import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();

describe("the observatory's nightly reload", () => {
  test("the screen is told the next 3am in the chart's time zone, and the server's time, so its own clock doesn't matter", async () => {
    const chart = await chartWithObservatory(harness, "Our House", "America/Chicago");
    harness.clock.set(new Date("2026-11-24T20:00:00Z")); // 2pm in Chicago

    const schedule = await chart.screen.get("/api/observatory/schedule");

    expect(schedule.status).toBe(200);
    expect(schedule.body).toEqual({ now: "2026-11-24T20:00:00.000Z", nightlyReload: "2026-11-25T09:00:00.000Z" });
  });

  test("in the small hours, before 3am, it's later the same night; at 3am exactly, it's the next night", async () => {
    const chart = await chartWithObservatory(harness, "Our House", "Europe/London");

    harness.clock.set(new Date("2026-11-25T01:30:00Z"));
    const beforeThree = (await chart.screen.get("/api/observatory/schedule")).body.nightlyReload;
    harness.clock.set(new Date("2026-11-25T03:00:00Z"));
    const atThree = (await chart.screen.get("/api/observatory/schedule")).body.nightlyReload;

    expect(beforeThree).toBe("2026-11-25T03:00:00.000Z");
    expect(atThree).toBe("2026-11-26T03:00:00.000Z");
  });

  test("it follows daylight saving: after the clocks go forward, 3am is an hour earlier in UTC", async () => {
    const chart = await chartWithObservatory(harness, "Our House", "America/Chicago");
    harness.clock.set(new Date("2027-03-13T20:00:00Z")); // the day before the clocks go forward

    const schedule = await chart.screen.get("/api/observatory/schedule");

    expect(schedule.body.nightlyReload).toBe("2027-03-14T08:00:00.000Z");
  });

  test("only a paired screen asks", async () => {
    const chart = await chartWithObservatory(harness);

    expect((await chart.owner.get("/api/observatory/schedule")).status).toBe(401);
  });
});
