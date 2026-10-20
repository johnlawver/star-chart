import { describe, expect, test } from "vitest";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();

describe("the icon library", () => {
  test("it lists a starter set of icons for common chores, each with a label", async () => {
    const icons = (await harness.newClient().get("/api/icons")).body.icons;

    expect(icons).toEqual(
      expect.arrayContaining([
        { id: "bed", label: "Make your bed" },
        { id: "dental", label: "Brush teeth" },
        { id: "lego", label: "Tidy toys" },
      ]),
    );
    expect(icons.length).toBeGreaterThanOrEqual(30);
  });

  test("every icon is pure black and white, because thermal printers can't print colour or grey", async () => {
    const client = harness.newClient();
    const icons: { id: string }[] = (await client.get("/api/icons")).body.icons;

    for (const { id } of icons) {
      const svg = await client.getText(`/api/icons/${id}.svg`);
      expect(svg, id).toMatch(/^<svg/);
      const colours = [...svg.matchAll(/(?:stroke|fill)="([^"]+)"/g)].map((match) => match[1]);
      expect(colours.every((colour) => ["#000", "none"].includes(colour!)), `${id} uses ${colours}`).toBe(true);
    }
  });

  test("an icon that isn't in the library is not found", async () => {
    expect((await harness.newClient().get("/api/icons/not-an-icon.svg")).status).toBe(404);
  });
});
