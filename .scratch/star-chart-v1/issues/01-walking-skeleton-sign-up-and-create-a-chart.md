# 01: Walking skeleton: sign up and create a Chart

**What to build:** The first thin path through the whole stack. A grown-up signs up on the web with an email and password, creates a **Chart** with a name and time zone, becomes its **Owner**, and can sign out and back in to see their Chart. This ticket also sets up the foundation every later ticket relies on: a TypeScript Node server, Postgres in Docker, migrations from the first table, settings and secrets injected by Doppler, HTTPS locally, and an API test harness with a controllable Clock. See the spec: `.scratch/star-chart-v1/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The whole stack starts locally with a single command under `doppler run`, with Postgres in Docker. There are no committed `.env` files.
- [ ] Every schema change is a migration; a fresh database migrates from empty.
- [ ] The app is served over HTTPS locally.
- [ ] A grown-up can sign up with an email and password, create a Chart with a name and time zone, and become its Owner.
- [ ] A grown-up can sign in and sign out. A wrong password is refused.
- [ ] A server setting turns off creating new Charts. When it's off, sign-up refuses to create a Chart.
- [ ] API tests run against a real Postgres with a fake Clock, and act as clients through the public API only.
- [ ] A test shows that a grown-up can't read or change another Chart's data.
