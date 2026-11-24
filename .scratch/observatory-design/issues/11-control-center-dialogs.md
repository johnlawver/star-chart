# 11: Control Center dialogs that work on the frame

**What to build:** The Control Center also opens on the observatory's screen, behind a PIN. On the frame's kiosk, `window.confirm()` and `window.prompt()` silently do nothing, so removing a child, renaming one, removing grown-ups or categories, unpairing, rejecting with a note and dismissing a ticket don't work there. Replace them with in-page dialogs that work everywhere.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] One small in-page dialog component offers "are you sure?" (with a clear danger action) and "type something" (with optional text), and is usable by touch.
- [ ] Every `confirm()` and `prompt()` in the Control Center uses it. There are 12 today: renaming and removing children, removing grown-ups, transferring ownership, leaving, unpairing, rejecting with a note, dismissing, and removing categories, chores and topics.
- [ ] Nothing in `src/web` calls `alert`, `confirm` or `prompt`. A check in the test suite enforces it.
- [ ] Nothing in `src/web` opens new windows (`target="_blank"`, `window.open`). The kiosk would strand you there.
- [ ] Each action still behaves as before when confirmed, and does nothing when cancelled. Checked in a browser.
