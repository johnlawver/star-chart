import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();

/** Nova in a fresh chart, with helpers for making tasks with or without a category. */
async function novasChart() {
  const chart = await chartWithObservatory(harness);
  const nova = await chart.addChild("Nova");
  const menu = async () => (await chart.screen.get(`/api/observatory/children/${nova}/menu`)).body;
  const addCategory = async (name: string) => (await chart.owner.post("/api/categories", { name })).body.category;
  const addChore = async (name: string, extra: object = {}) =>
    (await chart.owner.post("/api/chores", { name, stars: 1, childIds: [nova], ...extra })).body.chore;
  const addTopic = async (name: string, extra: object = {}) => {
    const { topic } = (await chart.owner.post("/api/topics", { name, stars: 3, samples: "addition", ...extra })).body;
    await chart.owner.put(`/api/topics/${topic.id}/children/${nova}`, { level: 1 });
    return topic;
  };
  return { chart, nova, menu, addCategory, addChore, addTopic };
}

describe("tasks without a category", () => {
  test("a chore or topic can be made without a category, and shows on the child's main screen", async () => {
    const { menu, addChore, addTopic } = await novasChart();

    const chore = await addChore("Feed the cat");
    const topic = await addTopic("Addition");

    expect(await menu()).toEqual({
      categories: [],
      tasks: [
        expect.objectContaining({ kind: "quiz", id: topic.id, name: "Addition" }),
        expect.objectContaining({ kind: "chore", id: chore.id, name: "Feed the cat" }),
      ],
    });
  });

  test("a category can hold chores and quizzes together", async () => {
    const { menu, addCategory, addChore, addTopic } = await novasChart();
    const morning = await addCategory("Morning");

    await addChore("Make your bed", { categoryId: morning.id });
    await addTopic("Letters", { categoryId: morning.id, samples: "letters" });

    const [category] = (await menu()).categories;
    expect(category.name).toBe("Morning");
    expect(category.choices.map((choice: { kind: string; name: string }) => [choice.kind, choice.name])).toEqual([
      ["quiz", "Letters"],
      ["chore", "Make your bed"],
    ]);
  });
});
