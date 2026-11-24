## Agent skills

### Issue tracker

Issues are tracked as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Project conventions

Domain terms are defined in `CONTEXT.md`; use them exactly. Decisions and their reasons are in `docs/adr/`.

- **Secrets come from Doppler.** The app reads all secrets and settings from environment variables, injected with `doppler run -- <command>`, with one Doppler config per environment (for example `dev` and `prd`). Never commit `.env` files. Data created while the app runs, such as observatory pairing tokens and guest PINs, belongs in the database, not in Doppler.
- **Web first, hardware later.** Develop locally in Docker with a real database. Printers and scanners are interchangeable parts. Until real hardware is chosen, use the fake printer (shows tickets on screen) and fake scanner (type the code). Don't assume any particular device: the server might be a Mac mini, the screen an Android picture frame, the printer and camera attached to an ESP32.
- **The observatory follows The Dome (design A).** The family chose it on 2026-10-24; see `.scratch/observatory-design/verdict.md` and `spec.md`. Its screens are thin drawings (`src/web/observatory/dome/`) over a stable set of observatory actions and data (`src/web/observatory/main.tsx`), and its pictures are replaceable files (`src/web/observatory/art/`). It must follow the measured limits of the picture frame (README, "Running on the picture frame").
- **Build as if it's on the public internet.** It is deployed publicly at https://star-chart.johnlawver.com (Coolify on the user's VPS, settings from Doppler `prd`), and may become a hosted service. That means HTTPS everywhere, real logins and device pairing, database migrations from the first table, and a real email sender (with a local catcher in development).
- **Collect as little as possible about children.** A child is a nickname and their stars, nothing more.
