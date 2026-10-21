import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();

/** A chart with Nova and Pip, and a Math quiz category. */
async function aChartWithMath() {
  const chart = await chartWithObservatory(harness);
  const nova = await chart.addChild("Nova");
  const pip = await chart.addChild("Pip", "pictures");
  const { category } = (await chart.owner.post("/api/categories", { name: "Math", kind: "quiz", icon: "math" })).body;
  const addTopic = async (name: string, extra: object = {}) =>
    (await chart.owner.post("/api/topics", { categoryId: category.id, name, stars: 3, ...extra })).body.topic;
  const switchOn = (topicId: string, childId: string, level: number) =>
    chart.owner.put(`/api/topics/${topicId}/children/${childId}`, { level });
  return { chart, nova, pip, category, addTopic, switchOn };
}

describe("topics", () => {
  test("a child sees a quiz category with the topics switched on for them, and others see nothing", async () => {
    const { chart, nova, pip, category, addTopic, switchOn } = await aChartWithMath();
    const addition = await addTopic("Addition", { icon: "math" });
    await addTopic("Subtraction");
    await switchOn(addition.id, nova, 2);

    const novasMenu = (await chart.screen.get(`/api/observatory/children/${nova}/menu`)).body.categories;
    const pipsMenu = (await chart.screen.get(`/api/observatory/children/${pip}/menu`)).body.categories;

    expect(novasMenu).toEqual([
      {
        id: category.id,
        name: "Math",
        kind: "quiz",
        icon: "math",
        choices: [{ id: addition.id, name: "Addition", stars: 3, icon: "math", done: false }],
      },
    ]);
    expect(pipsMenu).toEqual([]);
  });

  test("grown-ups see each topic, and which children have it at which level", async () => {
    const { chart, nova, pip, addTopic, switchOn } = await aChartWithMath();
    const addition = await addTopic("Addition");
    await switchOn(addition.id, nova, 2);
    await switchOn(addition.id, pip, 1);
    await switchOn(addition.id, nova, 3); // moving Nova up a level

    const [math] = (await chart.owner.get("/api/categories")).body.categories;

    expect(math.topics).toEqual([
      {
        id: addition.id,
        name: "Addition",
        stars: 3,
        icon: null,
        samples: null,
        children: expect.arrayContaining([
          { childId: nova, level: 3 },
          { childId: pip, level: 1 },
        ]),
      },
    ]);
  });
});
