import { expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

// A quick heartbeat, so the test doesn't have to wait for the real one.
const harness = await startTestApp({ heartbeatMs: 100 });

test("a part that stops responding without disconnecting (lost power or Wi-Fi) is soon counted as offline", async () => {
  const chart = await chartWithObservatory(harness);
  const printer = await chart.connectPrinter();

  printer.goSilent();

  await expect
    .poll(async () => (await chart.owner.get("/api/observatories")).body.observatories[0].parts, { timeout: 2000 })
    .toContainEqual({ kind: "printer", online: false });
});
