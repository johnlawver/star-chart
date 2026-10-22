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

describe("icons on categories and chores", () => {
  test("grown-ups give categories and chores icons, and the observatory menu shows them", async () => {
    const { chartWithObservatory } = await import("./support/observatory.js");
    const chart = await chartWithObservatory(harness);
    const pip = await chart.addChild("Pip", "pictures");
    const { category } = (await chart.owner.post("/api/categories", { name: "Chores", kind: "chore", icon: "home" })).body;
    await chart.owner.post("/api/chores", { categoryId: category.id, name: "Feed the cat", stars: 1, childIds: [pip], icon: "cat" });

    const listed = (await chart.owner.get("/api/categories")).body.categories[0];
    const menu = (await chart.screen.get(`/api/observatory/children/${pip}/menu`)).body.categories[0];

    expect(listed.icon).toBe("home");
    expect(listed.chores[0].icon).toBe("cat");
    expect(menu.icon).toBe("home");
    expect(menu.choices[0].icon).toBe("cat");
  });

  test("an icon that isn't in the library is refused", async () => {
    const { chartWithObservatory } = await import("./support/observatory.js");
    const chart = await chartWithObservatory(harness);

    const category = await chart.owner.post("/api/categories", { name: "Chores", kind: "chore", icon: "unicorn" });

    expect(category.status).toBe(400);
  });

  test("the print job carries the icon, so the printer can print it large for a child who sees pictures", async () => {
    const { chartWithObservatory } = await import("./support/observatory.js");
    const chart = await chartWithObservatory(harness);
    const pip = await chart.addChild("Pip", "pictures");
    const { category } = (await chart.owner.post("/api/categories", { name: "Chores", kind: "chore", icon: "home" })).body;
    const { chore } = (
      await chart.owner.post("/api/chores", { categoryId: category.id, name: "Tidy toys", stars: 1, childIds: [pip], icon: "lego" })
    ).body;
    const printer = await chart.connectPrinter();

    await chart.screen.post(`/api/observatory/children/${pip}/tickets`, { kind: "chore", taskId: chore.id });

    expect((await printer.nextMessage()).ticket).toMatchObject({ displayStyle: "pictures", title: "Tidy toys", icon: "lego" });
    printer.close();
  });
});
