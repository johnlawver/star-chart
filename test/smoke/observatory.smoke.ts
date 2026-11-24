import { afterAll, beforeAll, expect, test } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import WebSocket from "ws";
import { buildApp } from "../../src/server/app.js";
import { createTestDatabase } from "../support/database.js";
import { FakeClock } from "../support/fake-clock.js";
import { FakeMailer } from "../support/fake-mailer.js";
import { FakePushSender } from "../support/fake-push.js";
import { uniqueEmail } from "../support/test-app.js";

// The one browser smoke test: the real observatory page, in a real (headless) browser, against the real server.
// It only checks the page loads, a child can be chosen, and a tap produces a print job. Everything else is
// tested through the API, because the observatory's screens will be redesigned.

const db = createTestDatabase();
const app = await buildApp({
  db,
  clock: new FakeClock(new Date()),
  mailer: new FakeMailer(),
  push: new FakePushSender(),
  config: { allowNewCharts: true, appUrl: "https://star-chart.test", vapidPublicKey: "test", scheduledJobsEveryMs: null },
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

/** Every animation running on a page has an end: on the frame, a looping one keeps a processor core busy forever. */
async function endlessAnimations(page: Page) {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => !Number.isFinite(animation.effect?.getComputedTiming().endTime ?? 0))
      .map((animation) => (animation as CSSAnimation).animationName ?? "unnamed"),
  );
}

/** Whether the observatory's own font (self-hosted, so it works offline and looks the same everywhere) is in use. */
async function observatoryFontLoaded(page: Page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some((font) => font.family.replace(/"/g, "") === "Observatory" && font.status === "loaded");
  });
}

/** The size the observatory's 800×1280 stage takes up on screen, after any turning and scaling. */
async function stageOnScreen(page: Page) {
  const box = (await page.locator("[data-stage]").boundingBox())!;
  return { width: Math.round(box.width), height: Math.round(box.height) };
}

/** Where the observatory's 800×1280 stage sits in the window, and whether it fits inside it. */
async function stageFits(page: Page) {
  const box = await page.locator("[data-stage]").boundingBox();
  const window = page.viewportSize()!;
  return Boolean(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= window.width + 1 && box.y + box.height <= window.height + 1);
}

// The frame presents itself as a 1280×800 landscape window though it hangs portrait, so the stage turns itself.
test.each([
  { window: "the frame's 1280×800 landscape window (the stage turns)", width: 1280, height: 800 },
  { window: "an 800×1280 portrait window", width: 800, height: 1280 },
])("on the observatory in $window, a child picks themselves and a chore, and the printer gets the ticket", async ({ width, height }) => {
  const grownUp = httpClient();
  const credentials = { email: uniqueEmail("smoke"), password: "correct horse battery staple" };
  await grownUp("POST", "/api/sign-up", { ...credentials, chartName: "Smoke Test", timeZone: "America/Chicago" });
  const { child } = await grownUp("POST", "/api/children", { nickname: "Nova", displayStyle: "words" });
  const { category } = await grownUp("POST", "/api/categories", { name: "Chores", kind: "chore" });
  await grownUp("POST", "/api/chores", { categoryId: category.id, name: "Make your bed", stars: 1, childIds: [child.id] });
  // A second chore, so tapping Chores shows the chores to pick from (a category with one task prints it at once).
  await grownUp("POST", "/api/chores", { categoryId: category.id, name: "Feed the cat", stars: 1, childIds: [child.id] });
  const screenSetup = httpClient();
  await screenSetup("POST", "/api/sign-in", credentials);
  const { deviceToken: screenToken } = await screenSetup("POST", "/api/observatories");
  await screenSetup("POST", "/api/sign-in", credentials); // the owner unlocked on the screen, to pair the printer
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

  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript((token) => localStorage.setItem("star-chart.observatory.deviceToken", token), screenToken);
  await page.goto(`${base}/observatory.html`);
  await page.getByRole("button", { name: "Nova" }).click();
  await page.getByRole("button", { name: "Chores" }).click();
  await page.getByRole("button", { name: /Make your bed/ }).click();

  await expect.poll(() => page.getByText("Printing your ticket!").isVisible()).toBe(true);
  expect(await printJob).toMatchObject({ childNickname: "Nova", title: "Make your bed" });
  expect(await stageFits(page)).toBe(true);
  // Both windows are exactly the design's size, one way or the other, so the design fills it at full size.
  expect(await stageOnScreen(page)).toEqual({ width, height });
  expect(await endlessAnimations(page)).toEqual([]);
  printer.close();
  await page.close();
});

test("pages are always checked for a newer version, while built files (named by their contents) are kept", async () => {
  const pages = await Promise.all(["/", "/observatory.html"].map((path) => fetch(base + path)));
  const html = await pages[1]!.text();
  const script = html.match(/src="([^"]+\.js)"/)?.[1];
  const built = await fetch(base + script);

  expect(pages.map((page) => page.headers.get("cache-control"))).toEqual(["no-cache", "no-cache"]);
  expect(built.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
});

test("the Art Gallery shows every piece of observatory art, and none of it is missing", async () => {
  const page = await browser.newPage({ viewport: { width: 800, height: 1280 } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/art-gallery.html`);
  await page.locator("[data-art-id]").first().waitFor();

  const shown = await page.locator("[data-art-id]").evaluateAll((entries) => entries.map((entry) => entry.getAttribute("data-art-id")));
  const missing = await page.locator("[data-missing]").evaluateAll((entries) => entries.map((entry) => entry.getAttribute("data-art-id")));
  const brokenImages = await page.locator("img").evaluateAll((images) =>
    (images as HTMLImageElement[]).filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.src),
  );
  const constellations = await page.locator("[data-constellation]").count();

  // The art the ticket asks for, by id: the store's items, the mascot and its moods, the jar, the dock.
  expect(shown).toEqual(
    expect.arrayContaining([
      "mascot/body",
      "mascot/mood-happy",
      "mascot/mood-wow",
      "outfits/hat-crown",
      "outfits/hat-wizard",
      "outfits/hat-helmet",
      "outfits/hair-spiky",
      "outfits/hair-curly",
      "stickers/rocket",
      "stickers/moon",
      "stickers/planet",
      "stickers/alien",
      "stickers/comet",
      "jar/glass",
      "jar/lid",
      "jar/inside",
      "star",
      "dock/back",
      "dock/store",
      "dock/stickers",
      "dock/sky",
      "sky",
    ]),
  );
  expect(missing).toEqual([]);
  expect(brokenImages).toEqual([]);
  expect(constellations).toBeGreaterThanOrEqual(12);
  expect(await stageFits(page)).toBe(true);
  expect(await endlessAnimations(page)).toEqual([]);
  expect(await observatoryFontLoaded(page)).toBe(true);
  expect(errors).toEqual([]);
  await page.close();
});
