# 17: Push notifications

**What to build:** Grown-ups enable push notifications in the installed Control Center PWA. Notifications go through a push outbox port to every device each grown-up has subscribed. They are sent for Hand-ins (grouped when several arrive close together), Reprint Requests, pool-low alerts and recycled-quiz alerts.

**Blocked by:** 05 (Hand in and approve), 10 (Quizzes), 16 (Reprint Requests)

**Status:** ready-for-agent

- [ ] A grown-up can subscribe a device to web push from the installed PWA, and unsubscribe.
- [ ] All push goes through the push outbox port, and tests read the outbox.
- [ ] Hand-ins notify the Chart's grown-ups. Several hand-ins within the grouping window (a server setting) become one notification (tested with the fake Clock).
- [ ] Reprint Requests, pool-low alerts and recycled-quiz alerts send notifications.
- [ ] Notifications never go to grown-ups in another Chart.
