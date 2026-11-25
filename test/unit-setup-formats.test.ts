import { describe, expect, test } from "vitest";
import { makeHandshake, readHandshake, readSetupGuide, setupGuideLink } from "../src/web/shared/unit-setup.js";

// The two QR codes that set up a unit (see .scratch/printer-unit/spec.md, "Formats"): the Setup Guide the unit prints,
// and the Handshake the phone shows. The setup page and the fake unit share this code, and the firmware matches it.

const home = { network: "HomeWiFi", password: "hunter22", server: "https://star-chart.example", code: "ABCD2345" };

describe("the Handshake QR", () => {
  test("is SC1, then the network, password, server and pairing code", () => {
    expect(makeHandshake(home)).toBe("SC1;S:HomeWiFi;P:hunter22;H:https\\://star-chart.example;C:ABCD2345;;");
  });

  test("reads back what was made, even with backslashes, semicolons, commas, colons and quotes in it", () => {
    const awkward = { ...home, network: 'Our "Fast" Net; 2,4: GHz', password: "a\\b;c,d:e\"f" };

    expect(readHandshake(makeHandshake(awkward))).toEqual({ ok: true, ...awkward });
  });

  test("an open network has an empty password", () => {
    const open = { ...home, password: "" };

    expect(makeHandshake(open)).toContain(";P:;");
    expect(readHandshake(makeHandshake(open))).toEqual({ ok: true, ...open });
  });

  test("a network name with letters from any language survives", () => {
    const named = { ...home, network: "Café ☕ 家" };

    expect(readHandshake(makeHandshake(named))).toEqual({ ok: true, ...named });
  });

  test("a future version is refused as such, so the unit can say it needs updating", () => {
    expect(readHandshake("SC2;S:HomeWiFi;P:x;H:https\\://a.example;C:ABCD2345;;")).toEqual({ ok: false, problem: "unknown-version" });
  });

  test("anything else (a ticket's code, a Wi-Fi QR, a handshake missing a part) isn't a handshake", () => {
    expect(readHandshake("SC-ABCDEFGH2345")).toEqual({ ok: false, problem: "not-a-handshake" });
    expect(readHandshake("WIFI:S:HomeWiFi;T:WPA;P:x;;")).toEqual({ ok: false, problem: "not-a-handshake" });
    expect(readHandshake("SC1;S:HomeWiFi;P:x;C:ABCD2345;;")).toEqual({ ok: false, problem: "not-a-handshake" });
    expect(readHandshake("SC1;S:;P:x;H:https\\://a.example;C:ABCD2345;;")).toEqual({ ok: false, problem: "not-a-handshake" });
  });
});

describe("the Setup Guide QR", () => {
  test("links to the setup page, with the unit's name and the networks it found after the #", () => {
    expect(setupGuideLink("https://star-chart.example", "7F3A", ["HomeWiFi", "Neighbours & Co"])).toBe(
      "https://star-chart.example/setup-unit.html#u=7F3A&n=HomeWiFi&n=Neighbours%20%26%20Co",
    );
  });

  test("keeps at most 8 networks, strongest (first) first, and drops more to stay under 300 characters", () => {
    const many = Array.from({ length: 12 }, (_, i) => `Network number ${i} with a long name`);

    const link = setupGuideLink("https://star-chart.example", "7F3A", many);

    expect(link.length).toBeLessThan(300);
    const kept = readSetupGuide(new URL(link).hash).networks;
    expect(kept.length).toBeLessThanOrEqual(8);
    expect(kept).toEqual(many.slice(0, kept.length));
  });

  test("the setup page reads the unit's name and networks back from the part after the #", () => {
    expect(readSetupGuide("#u=7F3A&n=HomeWiFi&n=Neighbours%20%26%20Co")).toEqual({ unit: "7F3A", networks: ["HomeWiFi", "Neighbours & Co"] });
    expect(readSetupGuide("")).toEqual({ unit: undefined, networks: [] });
  });
});
