# 12: Deploy Star Chart as a public website

**What to build:** Star Chart runs as a real website on a public HTTPS address. The frame (over home Wi-Fi), phones (anywhere, no Tailscale) and later the printer and scanner all reach it the same way. This replaces the Tailscale-only address, which the frame can't use: it can't run Tailscale, and it can't resolve `.local` names. Decided 2026-11-23: "this just needs to be deployed … we just rely on wifi and a website."

**Blocked by:** None (needs the hosting and domain choices below)

**Status:** in progress. Deployed 2026-11-23. A Google Trust Services certificate (chaining to GlobalSign Root CA) has been served since 2026-11-24 (see `docs/deployment.md`). Next: confirm on the frame.

**The certificate catch:** Android 6 lacks ISRG Root X1, so **Let's Encrypt certificates fail on the frame** (`net_error -202`). Most hosts (Fly, Render, Railway, Vercel, Tailscale Funnel) use Let's Encrypt. The frame report shows certificates from **Google Trust Services** loading (`*.workers.dev`). The public address must serve a certificate the frame trusts, which is why Cloudflare sits in front. Prove this on the frame before building on it. A throwaway Cloudflare quick tunnel to the dev server (`cloudflared tunnel --url http://localhost:4310`, random `trycloudflare.com` address) opened in the kiosk is a five-minute check.

**Decided 2026-11-23:** the user's RackNerd VPS running Coolify (details in the racknerd repo, `coolify-projects/star-chart/`). Address https://star-chart.johnlawver.com, public GitHub repo johnlawver/star-chart, Dockerfile build pack, Coolify Postgres 17 (internal), Doppler `star-chart/prd` loaded inside the container via a read-only `DOPPLER_TOKEN`, email via Resend SMTP. DNS stays at NS1. For the frame, Coolify's Traefik gets a second certificate resolver that issues from **Google Trust Services** (ACME with EAB), used by this app only. Every other site keeps Let's Encrypt.

**Frame certificate steps:**
1. (User) In Google Cloud, enable the Public Certificate Authority API, run `gcloud publicca external-account-keys create`, and put the key ID and HMAC in Doppler `racknerd` (`GTS_EAB_KID`, `GTS_EAB_HMAC`).
2. Add a `gts` resolver to the Coolify proxy config (Servers → Proxy): `caserver=https://dv.acme-v02.api.pki.goog/directory`, `eab.kid`, `eab.hmacencoded`, `email`, `storage=/traefik/acme-gts.json`, `httpchallenge.entrypoint=http`. Restart the proxy (a brief blip for all sites).
3. Change star-chart's Traefik labels from `certresolver=letsencrypt` to `certresolver=gts`, then redeploy.
4. Check the served chain ends at GlobalSign Root CA R1 (`openssl s_client -showcerts`), then cold-boot the frame with the kiosk URL set over ADB.

**Original options (superseded):**
- **Domain:** an existing domain, or a new one (Cloudflare Registrar, about $10 a year).
- **Where it runs:**
  - **A. The Mac mini at home, behind a Cloudflare Tunnel.** No port forwarding, no hosting bill, and the data stays at home. Production runs as its own service (separate Doppler `prd` config and database), apart from development. It depends on the Mac mini and home internet being up.
  - **B. A cloud host plus managed Postgres, behind Cloudflare.** It doesn't depend on the house and is closer to a future hosted service, but it costs a monthly bill and more setup.

Once decided:
- [ ] The frame's kiosk loads the public address after a cold boot. The certificate is trusted, with no workarounds on the frame.
- [ ] Phones use the same public address. The Control Center installs as a PWA there, and push notifications still work. VAPID keys and APP_URL are in Doppler `prd`.
- [ ] Live connections (WebSockets) work through Cloudflare, including the heartbeat.
- [x] Production has its own Doppler config and database. Migrations run on deploy. Still to do: `ALLOW_NEW_CHARTS` is off once our chart exists, emails go through a real sender, and the database is backed up nightly with a restore that has been tried once.
- [x] Release builds (`STAR_CHART_RELEASE=true`) leave out the Art Gallery and other development-only pages.
- [x] Sign-in, PINs and pairing have rate limits suited to the open internet (check the existing ones against public exposure).
- [x] The README describes deploying, and setting the frame's kiosk URL over ADB.
- [x] The CLAUDE.md conventions are updated: it now runs on the public internet, not just Tailscale.

2026-11-24: Rate limits added (`src/server/rate-limits.ts`, `test/rate-limits.test.ts`; the table is in `docs/deployment.md`). The limits cover wrong passwords per account and per address, wrong codes and links per address, password-reset emails per account and per address, and new charts per address. The visitor's address comes through Traefik (`TRUST_PROXY_HOPS=1` in the Dockerfile); the app's port was confirmed not to be published on the host. Observatory PINs keep their existing lockout. The README points to `docs/deployment.md`, and CLAUDE.md already describes the public site. What's left needs the user: the frame, phones and push on the public address, and WebSockets through the proxy. (Cloudflare isn't in front: the domain points straight at the VPS.)
