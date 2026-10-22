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

describe("one open chore and one open quiz", () => {
  test("a child can hold a chore and a quiz at once, but not two chores, even from different categories", async () => {
    const { chart, nova, addCategory, addChore, addTopic } = await novasChart();
    const morning = await addCategory("Morning");
    const evening = await addCategory("Evening");
    const bed = await addChore("Make your bed", { categoryId: morning.id });
    const teeth = await addChore("Brush teeth", { categoryId: evening.id });
    const addition = await addTopic("Addition");
    const printer = await chart.connectPrinter();
    const print = (kind: string, taskId: string) => chart.screen.post(`/api/observatory/children/${nova}/tickets`, { kind, taskId });

    const chore = await print("chore", bed.id);
    const quiz = await print("quiz", addition.id);
    const secondChore = await print("chore", teeth.id);

    expect([chore.status, quiz.status, secondChore.status]).toEqual([201, 201, 409]);
    expect(secondChore.body.error).toMatch(/already have a chore/i);
    printer.close();
  });
});

describe("renaming and removing categories", () => {
  test("a category can be renamed and given a new icon", async () => {
    const { chart, menu, addCategory, addChore } = await novasChart();
    const morning = await addCategory("Morning");
    await addChore("Make your bed", { categoryId: morning.id });

    const renamed = await chart.owner.patch(`/api/categories/${morning.id}`, { name: "Wake up", icon: "sun" });

    expect(renamed.status).toBe(200);
    expect((await menu()).categories[0]).toMatchObject({ id: morning.id, name: "Wake up", icon: "sun" });
  });

  test("removing a category keeps its tasks, now on the main screen, and open tickets carry on", async () => {
    const { chart, nova, menu, addCategory, addChore } = await novasChart();
    const morning = await addCategory("Morning");
    const bed = await addChore("Make your bed", { categoryId: morning.id });
    const printer = await chart.connectPrinter();
    const { ticketId } = await chart.print(nova, { categoryId: morning.id, choreId: bed.id }, printer);

    const removed = await chart.owner.delete(`/api/categories/${morning.id}`);
    const approved = await chart.owner.post(`/api/tickets/${ticketId}/approve`, {});

    expect(removed.status).toBe(204);
    expect(await menu()).toEqual({ categories: [], tasks: [expect.objectContaining({ kind: "chore", id: bed.id })] });
    expect(approved.status).toBe(200);
    printer.close();
  });

  test("another chart can't rename or remove our categories", async () => {
    const { addCategory } = await novasChart();
    const morning = await addCategory("Morning");
    const school = await chartWithObservatory(harness, "Room 12");

    const renamed = await school.owner.patch(`/api/categories/${morning.id}`, { name: "Sneaky" });
    const removed = await school.owner.delete(`/api/categories/${morning.id}`);

    expect([renamed.status, removed.status]).toEqual([404, 404]);
  });
});
