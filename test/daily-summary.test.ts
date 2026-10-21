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
        badge: 0,
      },
    ]);
    printer.close();
  });

  test("nothing goes out before 7pm, it goes out once however often the job runs, and again the next evening", async () => {
    clock.set(new Date("2026-10-20T23:59:00Z")); // 6:59pm in Chicago
    const { printer, summaries } = await aFamilyDay();
    await harness.runScheduledJobs();
    const before = summaries().length;

    clock.set(new Date("2026-10-21T00:00:00Z")); // 7pm
    await harness.runScheduledJobs();
    clock.set(new Date("2026-10-21T02:00:00Z")); // 9pm
    await harness.runScheduledJobs();
    await harness.runScheduledJobs();
    const thatEvening = summaries().length;
    clock.set(new Date("2026-10-22T00:00:00Z")); // 7pm the next day
    await harness.runScheduledJobs();

    expect(before).toBe(0);
    expect(thatEvening).toBe(1);
    expect(summaries()).toHaveLength(2);
    printer.close();
  });

  test("each chart gets its summary at its own 7pm", async () => {
    clock.set(new Date("2026-10-20T12:00:00Z"));
    const chicago = await aFamilyDay("America/Chicago");
    const london = await aFamilyDay("Europe/London");

    clock.set(new Date("2026-10-20T18:00:00Z")); // 7pm in London, 1pm in Chicago
    await harness.runScheduledJobs();
    const atLondonsSeven = [london.summaries().length, chicago.summaries().length];
    clock.set(new Date("2026-10-21T00:00:00Z")); // 7pm in Chicago
    await harness.runScheduledJobs();

    expect(atLondonsSeven).toEqual([1, 0]);
    expect([london.summaries().length, chicago.summaries().length]).toEqual([1, 1]);
    chicago.printer.close();
    london.printer.close();
  });

  test("if the server was down at 7pm it goes out when it's back that evening, but never after midnight", async () => {
    clock.set(new Date("2026-10-20T15:00:00Z"));
    const { printer, summaries } = await aFamilyDay();

    clock.set(new Date("2026-10-21T00:30:00Z")); // 7:30pm: back up after missing 7pm
    await harness.runScheduledJobs();
    const lateThatEvening = summaries().length;
    clock.set(new Date("2026-10-22T05:30:00Z")); // missed the whole next evening; now 12:30am the day after
    await harness.runScheduledJobs();

    expect(lateThatEvening).toBe(1);
    expect(summaries()).toHaveLength(1);
    printer.close();
  });

  test("only stars earned today count, not yesterday's, and not stars spent", async () => {
    clock.set(new Date("2026-10-20T15:00:00Z")); // Tuesday morning in Chicago
    const { chart, nova, earn, printer, summaries } = await aFamilyDay();
    await earn("Feed the cat", 4);
    clock.set(new Date("2026-10-21T15:00:00Z")); // Wednesday morning
    await earn("Tidy your room", 3);
    await chart.owner.post(`/api/children/${nova}/redemptions`, { amount: 5, note: "Ice cream" });

    clock.set(new Date("2026-10-22T00:00:00Z")); // Wednesday, 7pm
    await harness.runScheduledJobs();

    expect(summaries().at(-1)?.body).toContain("Nova: 3 ★");
    printer.close();
  });
});
