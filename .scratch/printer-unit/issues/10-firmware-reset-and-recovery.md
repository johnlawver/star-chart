# 10: Firmware: reset, and recovering from trouble

**What to build:** A way to start setup over, and sensible behaviour when things go wrong, so nobody needs a computer to fix the unit.

**Blocked by:** 08

**Status:** ready-for-human (needs the hardware; an agent can help write it)

- [ ] Holding the button (or a chosen pin) for 5 seconds at power-on wipes the saved settings and prints the Setup Guide.
- [ ] If the saved Wi-Fi can't be joined for a few minutes after power-on, it prints a slip ("Can't find HomeWiFi. Hold the button to set up again.") once, and keeps retrying quietly.
- [ ] Out of paper or a printer fault is reported to the server, so the Control Center's parts status can show it (a small server addition, specified when the hardware's signals are known).
- [ ] Its README says how to reset it.
