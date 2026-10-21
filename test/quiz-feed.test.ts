import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { startTestApp } from "./support/test-app.js";

const harness = await startTestApp();

/** A chart where Nova has Addition (level 2) and Pip has nothing yet, plus a quiz feed with its own Feed Key. */
async function aChartWithAFeed() {
  const chart = await chartWithObservatory(harness);
  const nova = await chart.addChild("Nova");
  const pip = await chart.addChild("Pip", "pictures");
  const { category } = (await chart.owner.post("/api/categories", { name: "Math", kind: "quiz" })).body;
  const { topic } = (await chart.owner.post("/api/topics", { categoryId: category.id, name: "Addition", stars: 3 })).body;
  await chart.owner.put(`/api/topics/${topic.id}/children/${nova}`, { level: 2 });
  const made = await chart.owner.post("/api/feed-keys", { label: "Quiz writer" });
  const feed = harness.newClient();
  feed.useDeviceToken(made.body.key);
  return { chart, nova, pip, category, topic, made, feed };
}

describe("feed keys", () => {
  test("an admin or the owner makes a Feed Key, shown once, and can list and revoke it", async () => {
    const { chart, made, feed } = await aChartWithAFeed();

    const listed = (await chart.owner.get("/api/feed-keys")).body.feedKeys;
    const working = await feed.get("/api/feed/pools");
    const revoked = await chart.owner.delete(`/api/feed-keys/${made.body.id}`);
    const afterRevoking = await feed.get("/api/feed/pools");

    expect(made.status).toBe(201);
    expect(made.body.key).toEqual(expect.any(String));
    expect(listed).toEqual([{ id: made.body.id, label: "Quiz writer", createdAt: expect.any(String), lastUsedAt: null }]);
    expect(JSON.stringify(listed)).not.toContain(made.body.key);
    expect(working.status).toBe(200);
    expect(revoked.status).toBe(204);
    expect(afterRevoking.status).toBe(401);
  });
});

describe("what the feed can see", () => {
  test("the feed lists every pool to fill, with children known only by id", async () => {
    const { nova, topic, feed } = await aChartWithAFeed();

    const response = await feed.get("/api/feed/pools");

    expect(response.body).toEqual({
      targetSize: 5,
      pools: [{ childId: nova, topicId: topic.id, topicName: "Addition", categoryName: "Math", level: 2, waiting: 0 }],
    });
    expect(JSON.stringify(response.body)).not.toMatch(/Nova|Pip/);
  });

  test("plain grown-ups and guests can't make Feed Keys", async () => {
    const { FakeMailer } = await import("./support/fake-mailer.js");
    const { uniqueEmail } = await import("./support/test-app.js");
    const { chart } = await aChartWithAFeed();
    const email = uniqueEmail("grown-up");
    await chart.owner.post("/api/invitations", { email });
    const grownUp = harness.newClient();
    await grownUp.post("/api/invitations/accept", {
      token: FakeMailer.linkParameter(harness.mailer.lastTo(email)!, "token"),
      password: "a good long password",
    });
    const { pin } = (await chart.owner.post("/api/guest-pins", {})).body;
    await chart.screen.post("/api/observatory/unlock-guest", { pin });

    const statuses = [(await grownUp.post("/api/feed-keys", {})).status, (await chart.screen.post("/api/feed-keys", {})).status];

    expect(statuses).toEqual([403, 403]);
  });
});

/** A quiz as the feed would send it. */
const aFeedQuiz = (childId: string, topicId: string, externalId: string, extra: object = {}) => ({
  childId,
  topicId,
  level: 2,
  externalId,
  title: "Addition",
  instructions: "Write the answer.",
  items: [
    { prompt: "6 + 4 =", answer: "10" },
    { prompt: "3 + 5 =", answer: "8" },
  ],
  ...extra,
});

describe("sending quizzes in", () => {
  test("a quiz the feed sends goes into the child's pool, and is what the child prints next", async () => {
    const { chart, nova, category, topic, feed } = await aChartWithAFeed();

    const sent = await feed.post("/api/feed/quizzes", aFeedQuiz(nova, topic.id, "quiz-001"));
    const pools = (await feed.get("/api/feed/pools")).body.pools;
    const printer = await chart.connectPrinter();
    await chart.screen.post(`/api/observatory/children/${nova}/tickets`, { categoryId: category.id, choiceId: topic.id });

    expect(sent.status).toBe(201);
    expect(pools[0].waiting).toBe(1);
    expect((await printer.nextMessage()).ticket.quiz.prompts).toEqual(["6 + 4 =", "3 + 5 ="]);
    printer.close();
  });

  test("sending the same quiz twice doesn't add it twice", async () => {
    const { nova, topic, feed } = await aChartWithAFeed();
    const first = await feed.post("/api/feed/quizzes", aFeedQuiz(nova, topic.id, "quiz-001"));

    const again = await feed.post("/api/feed/quizzes", aFeedQuiz(nova, topic.id, "quiz-001"));

    expect(again.status).toBe(200);
    expect(again.body).toEqual({ quizId: first.body.quizId, duplicate: true });
    expect((await feed.get("/api/feed/pools")).body.pools[0].waiting).toBe(1);
  });

  test("a quiz for an unknown child, or a topic the child doesn't have, or that's too long, is refused", async () => {
    const { pip, topic, feed } = await aChartWithAFeed();
    const tooMany = Array.from({ length: 21 }, (_, i) => ({ prompt: `${i} + 1 =`, answer: String(i + 1) }));

    const statuses = [
      (await feed.post("/api/feed/quizzes", aFeedQuiz("00000000-0000-4000-8000-000000000000", topic.id, "a"))).status,
      (await feed.post("/api/feed/quizzes", aFeedQuiz(pip, topic.id, "b"))).status,
      (await feed.post("/api/feed/quizzes", aFeedQuiz(pip, topic.id, "c", { items: tooMany }))).status,
    ];

    expect(statuses).toEqual([400, 400, 400]);
  });
});
