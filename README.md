# Star Chart

A reward system for households and classrooms. See `CONTEXT.md` for the words we use, `docs/adr/` for key decisions, and `.scratch/` for the spec and tickets.

An outside quiz service can keep children's quiz pools filled: see [docs/quiz-feed-api.md](docs/quiz-feed-api.md).

## Running it locally

You need Node 24+, Docker, the Doppler CLI and Tailscale.

1. Start Postgres and Mailpit: `npm run db:up`
2. Set up Doppler once, then add the secrets below to the `dev` config:
   ```
   doppler login
   doppler setup --project star-chart --config dev
   ```
   | Secret | Example | Meaning |
   | --- | --- | --- |
   | `DATABASE_URL` | `postgres://star_chart:star_chart_local@localhost:54329/star_chart` | The development database |
   | `ALLOW_NEW_CHARTS` | `true` | Whether new charts can be created (off unless set to `true`) |
   | `APP_URL` | `https://mini.example.ts.net` | The address people use, for links in emails |
   | `SMTP_URL` | `smtp://127.0.0.1:1025` | Where email goes; in development, Mailpit catches it |
   | `EMAIL_FROM` | `Star Chart <stars@star-chart.local>` | Who emails come from |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | from `npx web-push generate-vapid-keys` | Signs push notifications |
   | `VAPID_SUBJECT` | `mailto:you@example.com` | Who push services contact if something's wrong |
   | `PORT` | `4310` | Optional; defaults to 4310 |
3. Run `npm run dev`. It rebuilds the web pages and restarts the server on changes, on `http://127.0.0.1:4310`. Use tmux on a remote dev server so it survives an SSH disconnect.
4. For trusted HTTPS on your laptop, phone and observatory, put Tailscale in front of it once:
   ```
   tailscale serve --bg http://127.0.0.1:4310
   ```
   Then open `https://<this machine>.<your tailnet>.ts.net`. This is only reachable on your tailnet. From a desktop browser you can also use `ssh -L 4310:127.0.0.1:4310 <server>` and open `http://localhost:4310`.

Every email sent in development lands in Mailpit's inbox at `http://127.0.0.1:8025` on the dev server (`ssh -L 8025:127.0.0.1:8025 <server>` to open it from a laptop).

## Observatory art

Every picture on the children's observatory is a file in `src/web/observatory/art/files/`, named by its id: for example `stickers/rocket.svg`, `outfits/hat-crown.svg` or `mascot/body.svg`.

- **To replace a picture**, save a new SVG or PNG over the file with the same name (an SVG wins if both exist). No code changes are needed.
- **The mascot, its faces and its outfits** share one 200×200 canvas, so draw a new hat where it should sit on the head. Hair is drawn behind the body and hats in front.
- **The jar's lid, glass and inside** share one 200×250 canvas. `jar/inside` is the shape the stars fill: only its shape matters, not its colour. A jar of one size can have its own art, such as `jar/glass-50.svg`.
- **Constellations** are data, not pictures: `src/web/observatory/art/constellations.ts`.
- **Animations** live in `src/web/observatory/art/animations.ts`, each with its timing in one place.
- **New art** also needs a line in `src/web/observatory/art/manifest.ts`.

The **Art Gallery** at `/art-gallery.html` shows every picture and animation in all its states, and flags missing files in red. It's in development builds only. Open it on the observatory's own screen to judge size and smoothness there.

## Tests

`npm test` runs the API tests against the `star_chart_test` database in the same Postgres container. They don't need Doppler.

## Credits

The built-in icons are from [Tabler Icons](https://tabler.io/icons) by Paweł Kuna, used under the MIT licence (a copy ships in `node_modules/@tabler/icons/LICENSE`). Star Chart draws them in solid black with a heavier stroke for thermal printing.
