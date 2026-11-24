# Deployment

A household star chart: kids pick chores at an Observatory (an Android picture frame), grown-ups approve them in the Control Center, and stars add up.

- **Live:** https://star-chart.johnlawver.com (Control Center at `/`, Observatory at `/observatory.html`)
- **Code:** https://github.com/johnlawver/star-chart (`.coolify.json` at the repo root holds the Coolify IDs)
- **Build:** the repo's `Dockerfile`. Migrations run when the server starts. Health check: `GET /api/health` (checks the database too).
- **Settings:** Doppler `star-chart/prd`. Coolify holds only `DOPPLER_TOKEN`, a read-only service token named `coolify-2`; the container loads everything else through `doppler run`.
- **Database:** Coolify Postgres `star-chart-db` (internal only). The host name is in `DATABASE_URL`.
- **Email:** Resend over SMTP, sent from `stars@star-reader.johnlawver.com` until a Star Chart domain is verified in Resend.

## Certificate (Google Trust Services, not Let's Encrypt)

The Observatory frame (Android 6, WebView 106) doesn't trust Let's Encrypt. So this app alone uses a second Traefik resolver, `gts`, which issues from Google Trust Services. The chain is WR1 → GTS Root R1 → GlobalSign Root CA, and Android 6 trusts GlobalSign. Every other site still uses `letsencrypt`.

- **Proxy config** (`/data/coolify/proxy/docker-compose.yml`) has seven `--certificatesresolvers.gts.acme.*` lines after the letsencrypt ones. CA `https://dv.acme-v02.api.pki.goog/directory`, HTTP challenge, storage `/traefik/acme-gts.json`. The EAB key comes from the Google Cloud project `star-chart-certs` (`gcloud publicca external-account-keys create`) and is stored in Doppler `racknerd/dev` as `GTS_EAB_KID` / `GTS_EAB_HMAC`. Google requires a contact email (the letsencrypt resolver has none).
- **App labels:** the https router's `tls.certresolver=gts` (custom labels, set via the API).
- **Gotchas found while setting this up (2026-11-24):**
  - Traefik won't request a new certificate while it already holds a valid one for the domain from another resolver. Star-chart's Let's Encrypt entry had to be removed from `acme.json` first.
  - Recreating the proxy by hand with `docker compose up -d --force-recreate` drops its links to service networks (Uptime Kuma's `kt4ubqkzq29pe7b8a8nxyd3p`). Reconnect with `docker network connect <net> coolify-proxy`, or restart the proxy from the Coolify UI, which reconnects them.
  - Backups from before the change: `docker-compose.yml.bak-before-gts` and `acme.json.bak-before-gts`.

## Deploying

Pushing to `main` doesn't deploy by itself (Coolify pulls the public repo without a webhook). To deploy, trigger it through the Coolify API, using the token in Doppler `racknerd/dev`:

```sh
T=$(doppler secrets get COOLIFY_API_TOKEN --plain -p racknerd -c dev)
curl -sS -X POST https://dashboard.johnlawver.com/api/v1/deploy -H "Authorization: Bearer $T" \
  -H "Content-Type: application/json" -d '{"uuid":"sbws0pz4ridedgmngflgj1uh","force":false}'
```

To change a setting: edit Doppler `star-chart/prd`, then restart the app (`POST /api/v1/applications/sbws0pz4ridedgmngflgj1uh/restart`).

## Pointing the frame at it

`?turn=right` turns the portrait design for the frame, which reports a landscape window (`?turn=left` if it comes out upside down).

With ADB connected to the frame:

```sh
adb shell am start -n com.wesbos.homehq/.MainActivity --es url 'https://star-chart.johnlawver.com/observatory.html?turn=right'
```
