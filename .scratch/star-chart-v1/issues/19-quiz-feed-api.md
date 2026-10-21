# 19: Quiz feed API

**What to build:** An outside service (the **Quiz Feed**) keeps each child's **Quiz Pools** topped up and learns how finished quizzes went, through an API it polls (ADR 0004). An admin creates a **Feed Key** for the chart in the Control Center and can revoke it. With that key, the feed can: list the chart's pools that need filling; read finished quizzes and their outcomes since its last look; send new quizzes in; and withdraw quizzes that haven't been printed yet. The feed knows children only by id: never by nickname.

**Blocked by:** 10 (Quizzes: Topics, Levels and Quiz Pools)

**Status:** ready-for-agent

- [ ] An owner or admin can create a Feed Key (shown once, stored only as a hash), list them, and revoke one. Plain grown-ups and guests can't. A revoked key stops working at once.
- [ ] The feed can list the chart's pools: for each child (by id only), topic and the child's current level, how many unprinted quizzes the pool holds and the chart's target pool size (default 5, set by grown-ups). Nothing in any feed response contains a child's nickname.
- [ ] The feed can read finished quizzes since a cursor: which child (id), topic, level, the feed's own id for the quiz, the outcome (approved, or dismissed; with how many times it was rejected first), the stars offered and awarded, the score if one was recorded, and when. The cursor lets it fetch only what's new.
- [ ] The feed can send a quiz into a pool: child id, topic, level, its own id for the quiz, a title, short instructions, and 1 to 20 items, each a prompt and an answer of limited length. The same feed id sent twice doesn't create a duplicate. A quiz for a child or topic that isn't in the chart, or a topic the child doesn't have switched on, is refused.
- [ ] The feed can withdraw a quiz that hasn't been printed yet (for example after a level change). A printed quiz can't be withdrawn.
- [ ] A Feed Key only ever reaches its own chart (API tests), and can't be used for anything but the feed endpoints.
- [ ] The Control Center shows Feed Keys (with when each was last used) and the target pool size.
