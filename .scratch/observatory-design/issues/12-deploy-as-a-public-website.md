# 12: Deploy Star Chart as a public website

**What to build:** Star Chart runs as a real website on a public HTTPS address. The frame (over home Wi-Fi), phones (anywhere, no Tailscale) and later the printer and scanner all reach it the same way. This replaces the Tailscale-only address, which the frame can't use: it can't run Tailscale, and it can't resolve `.local` names. Decided 2026-11-23: "this just needs to be deployed … we just rely on wifi and a website."

**Blocked by:** None (needs the hosting and domain choices below)

**Status:** needs-info

**The certificate catch:** Android 6 lacks ISRG Root X1, so **Let's Encrypt certificates fail on the frame** (`net_error -202`). Most hosts (Fly, Render, Railway, Vercel, Tailscale Funnel) use Let's Encrypt. The frame report shows certificates from **Google Trust Services** loading (`*.workers.dev`). The public address must serve a certificate the frame trusts, which is why Cloudflare sits in front. Prove this on the frame before building on it. A throwaway Cloudflare quick tunnel to the dev server (`cloudflared tunnel --url http://localhost:4310`, random `trycloudflare.com` address) opened in the kiosk is a five-minute check.

**Open choices:**
- **Domain:** an existing domain, or a new one (Cloudflare Registrar, about $10 a year).
- **Where it runs:**
  - **A. The Mac mini at home, behind a Cloudflare Tunnel.** No port forwarding, no hosting bill, and the data stays at home. Production runs as its own service (separate Doppler `prd` config and database), apart from development. It depends on the Mac mini and home internet being up.
  - **B. A cloud host plus managed Postgres, behind Cloudflare.** It doesn't depend on the house and is closer to a future hosted service, but it costs a monthly bill and more setup.

Once decided:
- [ ] The frame's kiosk loads the public address after a cold boot. The certificate is trusted, with no workarounds on the frame.
- [ ] Phones use the same public address. The Control Center installs as a PWA there, and push notifications still work. VAPID keys and APP_URL are in Doppler `prd`.
- [ ] Live connections (WebSockets) work through Cloudflare, including the heartbeat.
- [ ] Production has its own Doppler config and database. Migrations run on deploy, `ALLOW_NEW_CHARTS` is off once our chart exists, emails go through a real sender, and the database is backed up nightly with a restore that has been tried once.
- [ ] Release builds (`STAR_CHART_RELEASE=true`) leave out the Art Gallery and other development-only pages.
- [ ] Sign-in, PINs and pairing have rate limits suited to the open internet (check the existing ones against public exposure).
- [ ] The README describes deploying, and setting the frame's kiosk URL over ADB.
- [ ] The CLAUDE.md conventions are updated: it now runs on the public internet, not just Tailscale.
