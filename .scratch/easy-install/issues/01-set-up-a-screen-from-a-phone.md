# 01: Set up an observatory's screen from a phone

**What to build:** A fresh observatory screen shows a QR code and a short code instead of an email and password form. A grown-up scans it with their phone, signs in there (or creates a chart), checks the code matches, and taps Connect. The screen notices within a few seconds and pairs, as if they had signed in on it. Typing an email and password on a picture frame's touch keyboard is slow; this is how a TV signs in to a streaming service.

**Blocked by:** None

**Status:** done (2026-11-25)

- [x] A fresh screen asks the server for a **screen setup**: a public code (in the QR and shown on screen) and a separate secret that only the screen keeps. Neither is tied to anyone until approved.
- [x] The QR opens `/connect-screen.html#c=<code>` on a phone. The code is after `#`, so it stays out of server logs. The page signs the grown-up in, or creates a chart, then shows the code and asks them to check it matches the screen before connecting.
- [x] Only an owner or admin can approve. Others get 403. A code that is wrong, expired or already used is 404 and counts as a wrong code for rate limiting.
- [x] Approving connects the screen to the grown-up's chart as a new observatory, exactly as signing in on the screen does today. The screen collects its device credential once, with its secret; knowing the public code alone gets nothing.
- [x] Setups expire after 10 minutes. An expired screen makes a new one by itself. Making setups is rate-limited per address.
- [x] Signing in on the screen with an email and password stays available behind a "Sign in on this screen instead" button.
- [x] Works on the picture frame (WebView 106).

## Comments

2026-11-25: Done. The frame starts a setup with `POST /api/screen-setups` (`{code, secret, expiresAt}`; 30 an hour per address) and shows a QR of `/connect-screen.html#c=<code>` with the code beneath it, spaced as two groups of four. It asks `POST /api/screen-setups/collect` with its secret every 2 s and gets `{waiting: true}`, then its `deviceToken` once (201), or 404 when the setup has run out, when it starts a new one. If the server can't be reached it keeps trying with the usual backoff and says so. The phone page signs in or creates a chart, takes the code out of the address bar, shows it to check against the screen, and approves with `POST /api/screen-setups/approve` (owner or admin, 403 for others; 404 for a wrong, used or expired code, counted as a wrong code). Codes ignore case, spaces and dashes, so typed ones work too. Approving gives the screen 5 more minutes to collect. Only hashes of the code and secret are stored (migration 0035). Unlike signing in on the screen, approving leaves the phone signed in. Tests: `test/screen-setups.test.ts`, and two smoke tests (the whole phone journey, and signing in on the screen instead).
