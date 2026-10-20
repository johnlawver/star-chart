# 01: Walking skeleton: sign up and create a Chart

**What to build:** The first thin path through the whole stack. A grown-up signs up on the web with an email and password, creates a **Chart** with a name and time zone, becomes its **Owner**, and can sign out and back in to see their Chart. This ticket also sets up the foundation every later ticket relies on: a TypeScript Node server, Postgres in Docker, migrations from the first table, settings and secrets injected by Doppler, HTTPS locally, and an API test harness with a controllable Clock. See the spec: `.scratch/star-chart-v1/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The whole stack starts locally with a single command under `doppler run`, with Postgres in Docker. There are no committed `.env` files.
- [x] Every schema change is a migration; a fresh database migrates from empty.
- [x] The app is served over HTTPS locally, via `tailscale serve` at `https://mini.wolverine-pumpkinseed.ts.net/` (confirmed loading on a phone).
- [x] A grown-up can sign up with an email and password, create a Chart with a name and time zone, and become its Owner.
- [x] A grown-up can sign in and sign out. A wrong password is refused.
- [x] A server setting turns off creating new Charts. When it's off, sign-up refuses to create a Chart.
- [x] API tests run against a real Postgres with a fake Clock, and act as clients through the public API only.
- [x] A test shows that a grown-up can't read or change another Chart's data.

## Notes

- The whole stack starts with `npm run dev` under `doppler run` (Doppler project `star-chart`, config `dev`). The server defaults to port 4310 because another app on the dev server already uses 3000.
- HTTPS comes from `tailscale serve` rather than certificates in the app, because development happens over SSH on a headless server and phones need a trusted certificate. It's switched on with `tailscale serve --bg http://127.0.0.1:4310` (see README). Requests from the Mac mini to its own Tailscale address fail the TLS handshake, but other devices on the tailnet work fine.
- Docker Desktop is the container runtime. On the headless Mac mini it needs a logged-in desktop session to start.
