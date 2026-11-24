import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { animations } from "../src/web/observatory/art/animations.js";
import { findFrameUnsafeColours } from "../vite/frame-safe.js";

// Rules from measuring the real picture frame (PF1007L, WebView 106). See "The frame (measured)" in the spec.

describe("the observatory's animations", () => {
  test("every one ends: a looping animation keeps the frame's processor busy for as long as it runs", () => {
    const loops = Object.entries(animations).filter(([, a]) => !(Number.isFinite(a.repeat) && a.repeat >= 1));

    expect(loops).toEqual([]);
  });

  test("every one is over within a few seconds, repeats included", () => {
    const long = Object.entries(animations).filter(([, a]) => a.durationMs * a.repeat > 3000);

    expect(long).toEqual([]);
  });
});

describe("colours the frame can read", () => {
  test("4- and 8-digit hex colours are found, wherever they are", () => {
    const css = ".a{color:#fff8}.b{background:#11223344}";
    const js = 'style:{color:"#ABCD"}';

    expect(findFrameUnsafeColours(css)).toEqual(["#fff8", "#11223344"]);
    expect(findFrameUnsafeColours(js)).toEqual(["#ABCD"]);
  });

  test("3- and 6-digit hex colours, and things that only look a bit like colours, are fine", () => {
    const fine = '.a{color:#fff;background:#ffd84d} a[href="#top"] #section-2 {} url(#clip1234-a) "#1234567"';

    expect(findFrameUnsafeColours(fine)).toEqual([]);
  });

  test("the QR code library's defaults are allowed: it turns them into rgba() itself, so they never reach CSS", () => {
    const qrcode = "dark:hex2rgba(e.color.dark||\"#000000ff\"),light:hex2rgba(e.color.light||\"#ffffffff\")";

    expect(findFrameUnsafeColours(qrcode)).toEqual([]);
  });
});

describe("pages that work in the frame's kiosk", () => {
  // The kiosk silently ignores browser dialogs, and a new window would strand you with no way back.
  const webFiles = readdirSync("src/web", { recursive: true, encoding: "utf8" })
    .filter((path) => /\.(tsx?|html)$/.test(path))
    .map((path) => join("src/web", path));

  test("nothing uses alert, confirm or prompt", () => {
    const uses = webFiles.flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) => (/\b(alert|confirm|prompt)\s*\(/.test(line) && !/^\s*(\/\/|\*)/.test(line) ? [`${file}:${index + 1}`] : [])),
    );

    expect(uses).toEqual([]);
  });

  test("nothing opens a new window", () => {
    const uses = webFiles.filter((file) => /target=["']_blank|window\.open\s*\(/.test(readFileSync(file, "utf8")));

    expect(uses).toEqual([]);
  });
});
