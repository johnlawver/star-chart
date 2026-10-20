import { afterAll, beforeAll, expect, test } from "vitest";
import { chromium, type Browser } from "playwright";
import WebSocket from "ws";
import { buildApp } from "../../src/server/app.js";
import { createTestDatabase } from "../support/database.js";
import { FakeClock } from "../support/fake-clock.js";
import { FakeMailer } from "../support/fake-mailer.js";
import { uniqueEmail } from "../support/test-app.js";

// The one browser smoke test: the real observatory page, in a real (headless) browser, against the real server.
// It only checks the page loads, a child can be chosen, and a tap produces a print job. Everything else is
// tested through the API, because the observatory's screens will be redesigned.

const db = createTestDatabase();
const app = await buildApp({
  db,
  clock: new FakeClock(new Date()),
  mailer: new FakeMailer(),
  config: { allowNewCharts: true, appUrl: "https://star-chart.test" },
});
let base = "";
let browser: Browser;

beforeAll(async () => {
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  if (!address || typeof address === "string") throw new Error("server has no port");
  base = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  await app.close();
  await db.destroy();
});

/** Talks to the API over real HTTP, keeping a session cookie like a browser would. */
function httpClient() {
  let cookie = "";
  return async (method: string, path: string, body?: unknown, deviceToken?: string) => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers.cookie = cookie;
    if (deviceToken) headers.authorization = `Bearer ${deviceToken}`;
    const response = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0] ?? "";
    return response.status === 204 ? undefined : await response.json();
  };
}

test("on the observatory, a child picks themselves and a chore, and the printer gets the ticket", async () => {
  const grownUp = httpClient();
  const credentials = { email: uniqueEmail("smoke"), password: "correct horse battery staple" };
  await grownUp("POST", "/api/sign-up", { ...credentials, chartName: "Smoke Test", timeZone: "America/Chicago" });
  const { child } = await grownUp("POST", "/api/children", { nickname: "Nova", displayStyle: "words" });
  const { category } = await grownUp("POST", "/api/categories", { name: "Chores", kind: "chore" });
  await grownUp("POST", "/api/chores", { categoryId: category.id, name: "Make your bed", stars: 1, childIds: [child.id] });
  const screenSetup = httpClient();
  await screenSetup("POST", "/api/sign-in", credentials);
  const { deviceToken: screenToken } = await screenSetup("POST", "/api/observatories");
  const { code } = await screenSetup("POST", "/api/observatory/pairing-codes", undefined, screenToken);
  const { deviceToken: printerToken } = await httpClient()("POST", "/api/parts", { code, kind: "printer" });
  const printer = new WebSocket(`${base.replace("http", "ws")}/api/parts/live`);
  const printJob = new Promise<any>((resolve) =>
    printer.on("message", (data) => {
      const message = JSON.parse(String(data));
      if (message.type === "print") resolve(message.ticket);
    }),
  );
  await new Promise((resolve) => printer.on("open", resolve));
  printer.send(JSON.stringify({ type: "hello", deviceToken: printerToken }));

  const page = await browser.newPage();
  await page.addInitScript((token) => localStorage.setItem("star-chart.observatory.deviceToken", token), screenToken);
  await page.goto(`${base}/observatory.html`);
  await page.getByRole("button", { name: "Nova" }).click();
  await page.getByRole("button", { name: "Chores" }).click();
  await page.getByRole("button", { name: /Make your bed/ }).click();

  await expect.poll(() => page.getByText("Printing your ticket!").isVisible()).toBe(true);
  expect(await printJob).toMatchObject({ childNickname: "Nova", title: "Make your bed" });
  printer.close();
});
