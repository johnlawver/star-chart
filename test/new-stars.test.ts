import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();
const minute = 60_000;

/** Nova in a fresh chart, with ways to earn stars (a chore a grown-up approves), spend them, and open their screen. */
async function nova() {
  const chart = await chartWithObservatory(harness);
  const novaId = await chart.addChild("Nova");
  const printer = await chart.connectPrinter();
  const earn = async (title: string, stars: number) => {
    harness.clock.advanceBy(minute);
    const chore = await chart.addChore(title, stars, [novaId]);
    const { ticketId } = await chart.print(novaId, chore, printer);
    await chart.owner.post(`/api/tickets/${ticketId}/approve`, {});
  };
  const spend = (amount: number) => {
    harness.clock.advanceBy(minute);
    return chart.owner.post(`/api/children/${novaId}/redemptions`, { amount, note: "Ice cream" });
  };
  const newStars = async (screen = chart.screen) => (await screen.get(`/api/observatory/children/${novaId}`)).body.child.newStars;
  const visit = (screen = chart.screen) => {
    harness.clock.advanceBy(minute);
    return screen.post(`/api/observatory/children/${novaId}/visit`, {});
  };
  return { chart, novaId, printer, earn, spend, newStars, visit };
}

describe("new stars since a child's last visit", () => {
  test("stars approved since a child was added are new, until they open their screen", async () => {
    const { earn, newStars, visit, printer } = await nova();
    await earn("Feed the cat", 2);
    await earn("Tidy your room", 1);

    expect(await newStars()).toBe(3);
    const visited = await visit();

    expect(visited.status).toBe(204);
    expect(await newStars()).toBe(0);
    printer.close();
  });

  test("only stars approved after the last visit are new", async () => {
    const { earn, newStars, visit, printer } = await nova();
    await earn("Feed the cat", 2);
    await visit();

    await earn("Make your bed", 1);
    await earn("Tidy your room", 3);

    expect(await newStars()).toBe(4);
    printer.close();
  });

  test("spending stars doesn't make them any less new", async () => {
    const { earn, spend, newStars, printer } = await nova();
    await earn("Feed the cat", 5);

    await spend(4);

    expect(await newStars()).toBe(5);
    printer.close();
  });

  test("a child who has just been added has no new stars", async () => {
    const { newStars, printer } = await nova();

    expect(await newStars()).toBe(0);
    printer.close();
  });

  test("new stars arrive once: opening the screen on one observatory clears them on the other", async () => {
    const { chart, earn, newStars, visit, printer } = await nova();
    const kitchen = await chart.pairAnotherScreen();
    await earn("Feed the cat", 2);

    expect(await newStars(kitchen)).toBe(2);
    await visit(chart.screen);

    expect(await newStars(kitchen)).toBe(0);
    printer.close();
  });

  test("a visit for a child who isn't in this chart, or doesn't exist, is not found", async () => {
    const { novaId, printer } = await nova();
    const school = await chartWithObservatory(harness, "Room 12");

    const theirs = await school.screen.post(`/api/observatory/children/${novaId}/visit`, {});
    const nobody = await school.screen.post("/api/observatory/children/not-a-child/visit", {});

    expect([theirs.status, nobody.status]).toEqual([404, 404]);
    printer.close();
  });

  test("only an observatory's screen records a visit", async () => {
    const { chart, novaId, printer } = await nova();

    const grownUp = await chart.owner.post(`/api/observatory/children/${novaId}/visit`, {});

    expect(grownUp.status).toBe(401);
    printer.close();
  });
});
