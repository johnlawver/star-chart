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

/**
 * A chart with Nova (who reads words), two chores in a Chores category, and an observatory whose printer and scanner are
 * paired and connected. `printJobs` collects what the printer is sent.
 */
async function observatoryWithNova() {
  const grownUp = httpClient();
  const credentials = { email: uniqueEmail("smoke"), password: "correct horse battery staple" };
  await grownUp("POST", "/api/sign-up", { ...credentials, chartName: "Smoke Test", timeZone: "America/Chicago" });
  const { child } = await grownUp("POST", "/api/children", { nickname: "Nova", displayStyle: "words" });
  const { category } = await grownUp("POST", "/api/categories", { name: "Chores", kind: "chore" });
  await grownUp("POST", "/api/chores", { categoryId: category.id, name: "Make your bed", stars: 1, childIds: [child.id] });
  // A second chore, so tapping Chores shows the chores to pick from (a category with one task prints it at once).
  await grownUp("POST", "/api/chores", { categoryId: category.id, name: "Feed the cat", stars: 2, childIds: [child.id] });
  const screenSetup = httpClient();
  await screenSetup("POST", "/api/sign-in", credentials);
  const { deviceToken: screenToken } = await screenSetup("POST", "/api/observatories");
  await screenSetup("POST", "/api/sign-in", credentials); // the owner unlocked on the screen, to pair its parts
  const connect = async (kind: "printer" | "scanner") => {
    const { code } = await screenSetup("POST", "/api/observatory/pairing-codes", undefined, screenToken);
    const { deviceToken } = await httpClient()("POST", "/api/parts", { code, kind });
    const socket = new WebSocket(`${base.replace("http", "ws")}/api/parts/live`);
    const welcomed = new Promise((resolve) => socket.on("message", (data) => JSON.parse(String(data)).type === "welcome" && resolve(undefined)));
    await new Promise((resolve) => socket.on("open", resolve));
    socket.send(JSON.stringify({ type: "hello", deviceToken }));
    await welcomed;
    return socket;
  };
  const printer = await connect("printer");
  const scanner = await connect("scanner");
  const printJobs: any[] = [];
  printer.on("message", (data) => {
    const message = JSON.parse(String(data));
    if (message.type === "print") printJobs.push(message.ticket);
  });
  const openScreen = async (viewport: { width: number; height: number }, query = "") => {
    const page = await browser.newPage({ viewport });
    await page.addInitScript((token) => localStorage.setItem("star-chart.observatory.deviceToken", token), screenToken);
    return { page, go: () => page.goto(`${base}/observatory.html${query}`) };
  };
  const close = () => {
    printer.close();
    scanner.close();
  };
  return { printJobs, scanner, openScreen, close };
}

// The frame presents itself as a 1280×800 landscape window though it hangs portrait, so its kiosk address asks the stage
// to turn (?turn=right). Anywhere else, such as a computer, the design stays upright.
test.each([
  { window: "the frame (1280×800, ?turn=right: turned, filling the window)", width: 1280, height: 800, query: "?turn=right", shown: { width: 1280, height: 800 } },
  { window: "a computer's 1280×800 window (upright, full height)", width: 1280, height: 800, query: "", shown: { width: 500, height: 800 } },
  { window: "an 800×1280 portrait window", width: 800, height: 1280, query: "", shown: { width: 800, height: 1280 } },
])("in The Dome on $window, Nova picks themselves and a chore, it prints, and scanning it in is celebrated", async ({ width, height, query, shown }) => {
  const { printJobs, scanner, openScreen, close } = await observatoryWithNova();
  const { page, go } = await openScreen({ width, height }, query);
  await go();

  await page.getByRole("button", { name: /Nova/ }).click();
  await page.getByRole("button", { name: "My stars: 0" }).waitFor();
  await page.getByRole("button", { name: /Chores/ }).click();
  await page.getByRole("button", { name: /Make your bed/ }).click();

  await expect.poll(() => page.getByText("Here's your ticket!").isVisible()).toBe(true);
  await expect.poll(() => printJobs.length).toBe(1);
  expect(printJobs[0]).toMatchObject({ childNickname: "Nova", title: "Make your bed" });

  scanner.send(JSON.stringify({ type: "scan", code: printJobs[0].code }));
  await expect.poll(() => page.getByText("Great job, Nova!").isVisible()).toBe(true);

  expect(await stageFits(page)).toBe(true);
  expect(await stageOnScreen(page)).toEqual(shown);
  expect(await endlessAnimations(page)).toEqual([]);
  close();
  await page.close();
});

test("a child's screen goes back to Who are you after a minute with no taps", async () => {
  const { openScreen, close } = await observatoryWithNova();
  const { page, go } = await openScreen({ width: 800, height: 1280 });
  await page.clock.install();
  await go();
  await page.getByRole("button", { name: /Nova/ }).click();
  await page.getByRole("button", { name: /Chores/ }).waitFor();

  await page.clock.fastForward(50_000);
  await page.getByRole("button", { name: /Chores/ }).click(); // a tap starts the minute again
  await page.clock.fastForward(50_000);
  expect(await page.getByText("Who are you?").isVisible()).toBe(false);
  await page.clock.fastForward(15_000);

  await expect.poll(() => page.getByText("Who are you?").isVisible()).toBe(true);
  close();
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

test("in the Control Center, removing and renaming ask in the page (the frame's kiosk ignores browser dialogs)", async () => {
  const page = await browser.newPage({ viewport: { width: 800, height: 1280 } });
  const browserDialogs: string[] = [];
  page.on("dialog", (dialog) => {
    browserDialogs.push(dialog.message());
    void dialog.dismiss();
  });
  const credentials = { email: uniqueEmail("dialogs"), password: "correct horse battery staple" };
  await page.request.post(`${base}/api/sign-up`, { data: { ...credentials, chartName: "Dialogs", timeZone: "America/Chicago" } });
  await page.request.post(`${base}/api/children`, { data: { nickname: "Nova", displayStyle: "words" } });
  await page.goto(`${base}/`);
  const children = page.locator("section", { has: page.getByRole("heading", { name: "Children" }) });
  await children.getByText("Nova", { exact: true }).waitFor();

  // Renaming asks for the new nickname, filled in with the old one.
  await children.getByRole("button", { name: "Rename" }).click();
  const rename = page.getByRole("dialog", { name: "New nickname" });
  await expect.poll(() => rename.getByRole("textbox").inputValue()).toBe("Nova");
  await rename.getByRole("textbox").fill("Luna");
  await rename.getByRole("button", { name: "Rename" }).click();
  await children.getByText("Luna", { exact: true }).waitFor();

  // Removing asks first. Cancelling keeps the child; confirming removes them.
  await children.getByRole("button", { name: "Remove" }).click();
  const remove = page.getByRole("dialog", { name: /Remove Luna\?/ });
  await remove.getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => remove.count()).toBe(0);
  expect(await children.getByText("Luna", { exact: true }).count()).toBe(1);

  await children.getByRole("button", { name: "Remove" }).click();
  await remove.getByRole("button", { name: "Remove Luna" }).click();
  await expect.poll(() => children.getByText("No children yet.").isVisible()).toBe(true);
  expect(browserDialogs).toEqual([]);
  await page.close();
});
