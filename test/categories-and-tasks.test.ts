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

describe("editing tasks", () => {
  test("a chore can be renamed and changed, moved into or out of a category, and given to other children", async () => {
    const { chart, nova, menu, addCategory, addChore } = await novasChart();
    const pip = await chart.addChild("Pip", "pictures");
    const morning = await addCategory("Morning");
    const chore = await addChore("Make bed");

    const changed = await chart.owner.patch(`/api/chores/${chore.id}`, {
      name: "Make your bed",
      stars: 2,
      icon: "bed",
      frequency: { times: 1, per: "week" },
      categoryId: morning.id,
      childIds: [nova, pip],
    });
    const inMorning = (await menu()).categories[0]?.choices[0];
    await chart.owner.patch(`/api/chores/${chore.id}`, { categoryId: null, childIds: [pip] });
    const novasAfter = await menu();
    const pipsAfter = (await chart.screen.get(`/api/observatory/children/${pip}/menu`)).body;

    expect(changed.status).toBe(200);
    expect(inMorning).toMatchObject({ kind: "chore", id: chore.id, name: "Make your bed", stars: 2, icon: "bed" });
    expect(novasAfter).toEqual({ categories: [], tasks: [] });
    expect(pipsAfter.tasks).toEqual([expect.objectContaining({ id: chore.id, name: "Make your bed" })]);
    const [listed] = (await chart.owner.get("/api/categories")).body.chores;
    expect(listed).toMatchObject({ frequency: { times: 1, per: "week" }, categoryId: null, childIds: [pip] });
  });

  test("a quiz topic can be renamed and changed, and moved into a category", async () => {
    const { chart, menu, addCategory, addTopic } = await novasChart();
    const math = await addCategory("Math");
    const topic = await addTopic("Adding");

    const changed = await chart.owner.patch(`/api/topics/${topic.id}`, {
      name: "Addition",
      stars: 4,
      icon: "math",
      samples: "subtraction",
      categoryId: math.id,
    });

    expect(changed.status).toBe(200);
    expect((await menu()).categories[0]).toMatchObject({
      name: "Math",
      choices: [expect.objectContaining({ kind: "quiz", id: topic.id, name: "Addition", stars: 4, icon: "math" })],
    });
    const [listed] = (await chart.owner.get("/api/categories")).body.topics;
    expect(listed).toMatchObject({ samples: "subtraction", categoryId: math.id });
  });
});

describe("removing tasks", () => {
  test("a removed chore isn't offered or listed any more, but an open ticket for it can still be approved", async () => {
    const { chart, nova, menu, addChore } = await novasChart();
    const chore = await addChore("Feed the cat", { stars: 2 });
    const printer = await chart.connectPrinter();
    const { ticketId } = await chart.print(nova, { choreId: chore.id }, printer);

    const removed = await chart.owner.delete(`/api/chores/${chore.id}`);
    const approved = await chart.owner.post(`/api/tickets/${ticketId}/approve`, {});

    expect(removed.status).toBe(204);
    expect(await menu()).toEqual({ categories: [], tasks: [] });
    expect((await chart.owner.get("/api/categories")).body.chores).toEqual([]);
    expect(approved.status).toBe(200);
    expect((await chart.owner.get(`/api/children/${nova}/constellation`)).body.balance).toBe(2);
    printer.close();
  });

  test("a removed quiz topic isn't offered, listed, or sent to the quiz feed", async () => {
    const { chart, menu, addTopic } = await novasChart();
    const topic = await addTopic("Addition");
    const { key } = (await chart.owner.post("/api/feed-keys", {})).body;
    const feed = harness.newClient();
    feed.useDeviceToken(key);

    const removed = await chart.owner.delete(`/api/topics/${topic.id}`);

    expect(removed.status).toBe(204);
    expect(await menu()).toEqual({ categories: [], tasks: [] });
    expect((await chart.owner.get("/api/categories")).body.topics).toEqual([]);
    expect((await feed.get("/api/feed/pools")).body.pools).toEqual([]);
  });

  test("another chart can't edit or remove our tasks", async () => {
    const { addChore, addTopic } = await novasChart();
    const chore = await addChore("Feed the cat");
    const topic = await addTopic("Addition");
    const school = await chartWithObservatory(harness, "Room 12");

    const statuses = [
      (await school.owner.patch(`/api/chores/${chore.id}`, { name: "Sneaky" })).status,
      (await school.owner.delete(`/api/chores/${chore.id}`)).status,
      (await school.owner.patch(`/api/topics/${topic.id}`, { name: "Sneaky" })).status,
      (await school.owner.delete(`/api/topics/${topic.id}`)).status,
    ];

    expect(statuses).toEqual([404, 404, 404, 404]);
  });
});
