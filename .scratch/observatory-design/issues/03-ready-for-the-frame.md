# 03: Ready for the frame

**What to build:** The observatory and the art from 02 follow what we measured on the real frame (see "The frame (measured)" in the spec and the frame report "PF1007L Frame Dashboard Reference"). The Art Gallery and the current plain observatory then load upright and run smoothly on the frame itself, ahead of The Dome.

**Blocked by:** 02 (Art folder and Art Gallery)

**Status:** ready-for-agent

- [ ] Build target `chrome106` and CSS target `chrome61`. A check fails the build if any built CSS or JS contains a 4- or 8-digit hex colour.
- [ ] The animations module allows only a finite repeat count (by type), and nothing loops:
  - twinkle becomes a one-off sparkle;
  - bounce is a short one-off hop;
  - confetti is 12 pieces;
  - the gallery shows each animation's length and confirms it ends.
- [ ] The starry background is a static, replaceable picture (`sky` in the art folder) instead of 50 twinkling dots.
- [ ] A self-hosted rounded font (OFL licence, woff2) lives in the art folder and is used by the observatory and the gallery. The licence is credited in the README.
- [ ] The art folder also accepts WebP and JPEG (preference: SVG, WebP, PNG, JPEG), and the README says art is drawn at display size (1×).
- [ ] A shared Stage component shows an 800×1280 design scaled to fit any window.
  - When the window is wider than tall, it turns a quarter turn so the design stays upright.
  - `?turn=left` or `?turn=right` (default `right`) chooses the direction.
  - Taps land where they look.
  - The Art Gallery and the observatory use it.
- [ ] HTML pages are served with `Cache-Control: no-cache`.
- [ ] The smoke test loads the observatory in a 1280×800 window and still taps a child and a task (the stage turned). It still passes in 800×1280.
- [ ] The README has a "Running on the picture frame" section: the WebView 106 limits, the "animations must end" rule, setting the kiosk URL over ADB, and live debugging with `adb reverse` and `chrome://inspect`.
