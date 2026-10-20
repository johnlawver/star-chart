import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();

describe("printing when the printer is offline", () => {
  test("with no printer connected, printing is refused with a reason, no ticket is made, and nothing prints later", async () => {
    const chart = await chartWithObservatory(harness);
    const nova = await chart.addChild("Nova");
    const chore = await chart.addChore("Feed the cat", 2, [nova]);

    const printed = await chart.screen.post(`/api/observatory/children/${nova}/tickets`, {
      categoryId: chore.categoryId,
      choiceId: chore.choreId,
    });

    expect(printed.status).toBe(503);
    expect(printed.body).toMatchObject({ reason: "printer-offline" });
    expect((await chart.owner.get("/api/tickets?state=open")).body.tickets).toEqual([]);
    const printerComingOnline = await chart.connectPrinter();
    await expect(printerComingOnline.nextMessage()).rejects.toThrow(/no message/);
    printerComingOnline.close();
  });
});
