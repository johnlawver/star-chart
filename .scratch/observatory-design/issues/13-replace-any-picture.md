# 13: Replace any picture from an admin panel

**What to build:** Every piece of observatory art can be replaced at runtime, from an admin screen, without a new release: the mascot and its faces, outfits, the jar, the dock buttons, the sky, the planets, the star and built-in stickers. That's the path from generated art to bespoke, hand-drawn art. The pictures that ship with the app stay as the defaults. An uploaded replacement wins over a default, and removing it brings the default back. Requested 2026-11-24.

**Blocked by:** 08 (uploads and art storage)

**Status:** needs-triage

Open questions (to settle before building):
- **Scope:** do replacements apply to one chart, or to the whole server (a server admin, which doesn't exist yet)? For an open-source install the server admin is whoever runs it.
- **Where the admin screen lives:** a "Pictures" page in the Control Center, or the Art Gallery grown into an admin panel.
- **Storage:** the database (as in 08) or an S3-compatible bucket (MinIO on Coolify). Ticket 08's storage module is the one place to change.
- **Checking replacements:** a replacement should match its slot's canvas (the manifest's canvas sizes), so a hat still sits on the head.

Sketch:
- `art_overrides (scope, art id, art file id)`. The front end asks the server for the overrides once, at load, and `artUrl(id)` prefers an override over the bundled file.
- The admin screen is the Art Gallery's layout with an upload button on each tile, a "custom" badge on replaced tiles, and "Back to the default".
