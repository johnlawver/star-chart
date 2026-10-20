import { describe, expect, test } from "vitest";
import { fakeSubscription } from "./support/fake-push.js";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();
const { push, clock } = harness;

/** A chart with Nova and Pip and the owner's phone subscribed. Nova earns some stars today, and holds an open ticket. */
async function aFamilyDay(timeZone = "America/Chicago") {
  const chart = await chartWithObservatory(harness, "Our House", timeZone);
  const nova = await chart.addChild("Nova");
  await chart.addChild("Pip", "pictures");
  const phone = fakeSubscription();
  await chart.owner.post("/api/push/subscriptions", phone);
  const printer = await chart.connectPrinter();
  const earn = async (title: string, stars: number) => {
    const { ticketId } = await chart.print(nova, await chart.addChore(title, stars, [nova]), printer);
    await chart.owner.post(`/api/tickets/${ticketId}/approve`, {});
  };
  const summaries = () => push.to(phone.endpoint).filter((message) => message.tag === "daily-summary");
  return { chart, nova, phone, printer, earn, summaries };
}

describe("the daily summary", () => {
  test("at 7pm in the chart's time zone, grown-ups get each child's stars today and their open tickets", async () => {
    clock.set(new Date("2026-10-20T15:00:00Z")); // 10am in Chicago
    const { chart, nova, printer, earn, summaries } = await aFamilyDay();
    await earn("Feed the cat", 2);
    await earn("Tidy your room", 3);
    await chart.print(nova, await chart.addChore("Make your bed", 1, [nova]), printer); // still open tonight

    clock.set(new Date("2026-10-21T00:00:00Z")); // 7pm in Chicago
    await harness.runScheduledJobs();

    expect(summaries()).toEqual([
      {
        title: "Today at Our House",
        body: "Pip: 0 ★, nothing open. Nova: 5 ★, 1 open ticket.",
        url: "https://star-chart.test/",
        tag: "daily-summary",
      },
    ]);
    printer.close();
  });
});
