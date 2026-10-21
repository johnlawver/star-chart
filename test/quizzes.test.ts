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

/** Nova with a Spelling topic switched on at level 1, a printer, and a way for a grown-up to write a quiz for him. */
async function novaWithSpelling() {
  const { chart, nova, pip, addTopic, switchOn } = await aChartWithMath();
  const { category } = (await chart.owner.post("/api/categories", { name: "Spelling", kind: "quiz" })).body;
  const spelling = (await chart.owner.post("/api/topics", { categoryId: category.id, name: "This week's words", stars: 4 })).body
    .topic;
  await switchOn(spelling.id, nova, 1);
  const printer = await chart.connectPrinter();
  const writeQuiz = (words: string[], extra: object = {}) =>
    chart.owner.post("/api/quizzes", {
      childId: nova,
      topicId: spelling.id,
      title: "Spelling",
      instructions: "Write each word.",
      items: words.map((word) => ({ prompt: `Spell: ${word}`, answer: word })),
      ...extra,
    });
  const print = () => chart.screen.post(`/api/observatory/children/${nova}/tickets`, { categoryId: category.id, choiceId: spelling.id });
  return { chart, nova, pip, category, spelling, printer, writeQuiz, print, addTopic, switchOn };
}

describe("printing quizzes", () => {
  test("a grown-up writes a quiz for a child; when the child taps the topic, it prints, without the answers", async () => {
    const { printer, writeQuiz, print } = await novaWithSpelling();
    const written = await writeQuiz(["because", "friend", "said"]);

    const printed = await print();
    const job = (await printer.nextMessage()).ticket;

    expect(written.status).toBe(201);
    expect(printed.status).toBe(201);
    expect(job).toMatchObject({
      title: "Spelling",
      stars: 4,
      quiz: { instructions: "Write each word.", prompts: ["Spell: because", "Spell: friend", "Spell: said"] },
    });
    expect(JSON.stringify(job)).not.toMatch(/"answer"/);
    printer.close();
  });

  test("each print takes the next quiz in the pool, with a new code", async () => {
    const { chart, printer, writeQuiz, print } = await novaWithSpelling();
    await writeQuiz(["cat"]);
    await writeQuiz(["dog"]);

    const first = await print();
    const firstJob = (await printer.nextMessage()).ticket;
    await chart.owner.post(`/api/tickets/${first.body.ticket.id}/approve`, {});
    await print();
    const secondJob = (await printer.nextMessage()).ticket;

    expect(firstJob.quiz.prompts).toEqual(["Spell: cat"]);
    expect(secondJob.quiz.prompts).toEqual(["Spell: dog"]);
    expect(secondJob.code).not.toBe(firstJob.code);
    printer.close();
  });
});

describe("levels and empty pools", () => {
  test("quizzes for a level the child has moved on from aren't printed", async () => {
    const { nova, spelling, printer, writeQuiz, print, switchOn } = await novaWithSpelling();
    await writeQuiz(["cat"]); // written for level 1
    await switchOn(spelling.id, nova, 2);
    await writeQuiz(["because"]); // written for level 2, Nova's level now

    await print();

    expect((await printer.nextMessage()).ticket.quiz.prompts).toEqual(["Spell: because"]);
    printer.close();
  });

  test("with nothing in the pool and nothing to reuse, the child is told there are no quizzes yet", async () => {
    const { chart, printer, print } = await novaWithSpelling();

    const printed = await print();

    expect(printed.status).toBe(409);
    expect(printed.body.error).toMatch(/no quizzes yet/i);
    expect((await chart.owner.get("/api/tickets?state=open")).body.tickets).toEqual([]);
    await expect(printer.nextMessage()).rejects.toThrow(/no message/);
    printer.close();
  });
});
