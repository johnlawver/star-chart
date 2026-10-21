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
