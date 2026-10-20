# Star Chart

A reward system for households and classrooms. See `CONTEXT.md` for the words we use, `docs/adr/` for key decisions, and `.scratch/` for the spec and tickets.

## Running it locally

You need Node 24+, Docker, the Doppler CLI and Tailscale.

1. Start Postgres: `npm run db:up`
2. Set up Doppler once, then add the secrets below to the `dev` config:
   ```
   doppler login
   doppler setup --project star-chart --config dev
   ```
   | Secret | Example | Meaning |
   | --- | --- | --- |
   | `DATABASE_URL` | `postgres://star_chart:star_chart_local@localhost:54329/star_chart` | The development database |
   | `ALLOW_NEW_CHARTS` | `true` | Whether new charts can be created (off unless set to `true`) |
   | `PORT` | `3000` | Optional; defaults to 3000 |
3. Run `npm run dev`. It rebuilds the web pages and restarts the server on changes, on `http://127.0.0.1:3000`. Use tmux on a remote dev server so it survives an SSH disconnect.
4. For trusted HTTPS on your laptop, phone and observatory, put Tailscale in front of it once:
   ```
   tailscale serve --bg http://127.0.0.1:3000
   ```
   Then open `https://<this machine>.<your tailnet>.ts.net`. This is only reachable on your tailnet. From a desktop browser you can also use `ssh -L 3000:127.0.0.1:3000 <server>` and open `http://localhost:3000`.

## Tests

`npm test` runs the API tests against the `star_chart_test` database in the same Postgres container. They don't need Doppler.
