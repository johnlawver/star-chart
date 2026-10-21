# The quiz feed is a separate service that pulls, per chart, without names

Quizzes are written by an outside service (the quiz feed), not by Star Chart itself, so the way quizzes are made can change, or move to an AI model provider, without touching the app. The feed reaches a chart through a Feed Key that an admin creates and can revoke, scoped to that one chart like every other credential (ADR 0002, ADR 0003). It **polls**: it asks which pools are below their target size and what happened to finished quizzes, and it sends new quizzes in. Star Chart never calls out to it, so the feed can run anywhere, including behind a home network, with no inbound connection. The feed knows children only by an opaque id, with their topics, levels and quiz history, and never sees nicknames, so quiz-making can be outsourced without sending children's names anywhere.

## Considered options

- **One service-wide key for every chart**: simpler for a hosted service, but one leaked key would expose every family. Can be added later, for an Operator.
- **Webhooks (Star Chart calls the feed when a pool runs low)**: quicker to react, but needs the feed to be reachable from Star Chart. Can be added alongside polling later without changing anything else.

## Consequences

- Quiz content is structured (a title, instructions, and items with a prompt and an answer), not free text, so it prints consistently, fits on a receipt, and gives grown-ups an answer key.
- Each quiz carries the feed's own id for it, so sending the same quiz twice doesn't create a duplicate.
