# Quiz feed API

How an outside quiz service (the **quiz feed**) keeps a chart's quiz pools filled. The design is in [ADR 0004](adr/0004-quiz-feed-is-a-pull-api.md); words like *pool*, *topic* and *level* are defined in [CONTEXT.md](../CONTEXT.md).

## The idea

The feed **polls**; Star Chart never calls it. On a schedule that suits you (every few minutes is plenty):

1. Ask which pools need quizzes (`GET /api/feed/pools`) and send enough to bring each up to `targetSize` (`POST /api/feed/quizzes`).
2. Read how finished quizzes went (`GET /api/feed/finished?after=…`) and use it to pitch the next ones: outcomes, scores, and how often a child needed another go.

The feed knows children only by id: never by nickname.

## Authentication

An owner or admin makes a **Feed Key** in the Control Center (Quiz settings → Quiz feed keys). It's shown once. Send it on every request:

```
Authorization: Bearer feed_…
```

A key reaches one chart, and only the endpoints below. Revoking it in the Control Center stops it at once. Requests with a missing, wrong or revoked key get `401`.

## `GET /api/feed/pools`

Every pool you could fill: each child and each topic switched on for them, at the child's **current** level.

```json
{
  "targetSize": 5,
  "pools": [
    {
      "childId": "9b0c…",
      "topicId": "4e1a…",
      "topicName": "Addition",
      "categoryName": "Math",
      "level": 2,
      "waiting": 1
    }
  ]
}
```

`categoryName` is `null` for a topic that isn't in a category. `waiting` counts quizzes not yet printed at that level. Send `targetSize - waiting` more to fill it. Quizzes for a level the child has moved on from stay where they are, but aren't printed (withdraw them if you like).

## `POST /api/feed/quizzes`

Puts a quiz in a child's pool.

```json
{
  "childId": "9b0c…",
  "topicId": "4e1a…",
  "level": 2,
  "externalId": "your-own-id-123",
  "title": "Addition",
  "instructions": "Write the answer.",
  "items": [
    { "prompt": "6 + 4 =", "answer": "10" },
    { "prompt": "3 + 5 =", "answer": "8" }
  ]
}
```

- `externalId` is **your** id for the quiz, unique within the chart. Sending the same one again is safe: you get `200` with `{ "quizId": "…", "duplicate": true }` and nothing is added. A new quiz gets `201` with `{ "quizId": "…" }`.
- Children see the `prompt`s (printed on a receipt); grown-ups see each `answer` when checking. Keep it receipt-sized: a `title` up to 60 characters, `instructions` up to 200, 1 to 20 `items`, each `prompt` and `answer` up to 100.
- `400` if the child or topic isn't in this chart, the topic isn't switched on for that child, or the quiz doesn't fit the rules above.

## `DELETE /api/feed/quizzes/{externalId}`

Withdraws a quiz that hasn't been printed (for example, after a child's level changed): `204`. A printed quiz can't be withdrawn: `409`. An id you never sent: `404`.

## `GET /api/feed/finished?after={cursor}`

Quizzes finished since your last look, oldest first (up to 100 at a time).

```json
{
  "quizzes": [
    {
      "externalId": "your-own-id-123",
      "childId": "9b0c…",
      "topicId": "4e1a…",
      "level": 2,
      "outcome": "approved",
      "rejections": 1,
      "starsOffered": 3,
      "starsAwarded": 3,
      "score": { "correct": 7, "outOf": 10 },
      "finishedAt": "2026-10-21T18:04:11.000Z"
    }
  ],
  "next": "1842"
}
```

- `outcome` is `approved` (done and checked) or `dismissed` (closed without stars: lost, too hard, or no longer needed).
- `rejections` is how many times a grown-up sent it back before it was finished.
- `score` is recorded by a grown-up when approving, and may be `null`. `starsAwarded` can differ from `starsOffered` when a grown-up gave a bonus or partial credit.
- `externalId` is `null` for quizzes that didn't come from the feed (written by a grown-up, or a built-in sample).
- Keep `next` and send it as `after` next time, to read only what's new. Leave `after` off the first time to read everything.
