# 17: Push notifications

**What to build:** Grown-ups enable push notifications in the installed Control Center PWA. Notifications go through a push outbox port to every device each grown-up has subscribed. They are sent for Hand-ins (grouped when several arrive close together), Reprint Requests, pool-low alerts and recycled-quiz alerts.

**Blocked by:** 05 (Hand in and approve), 10 (Quizzes), 16 (Reprint Requests)

**Status:** done (pool alerts are carried by ticket 10)

- [x] A grown-up can subscribe a device to web push from the installed PWA, and unsubscribe.
- [x] All push goes through the push outbox port, and tests read the outbox.
- [x] Hand-ins notify the Chart's grown-ups. Several hand-ins within the grouping window (a server setting) become one notification (tested with the fake Clock).
- [x] Reprint Requests send notifications. (Pool-low and recycled-quiz alerts: ticket 10, once quizzes exist.)
- [x] Notifications never go to grown-ups in another Chart.

## Notes

- Push goes through a `PushSender` port: real web push (the `web-push` library, VAPID keys in Doppler) or a fake outbox in tests. A subscription the push service reports gone (404/410) is deleted.
- A scheduled-jobs runner (every 30 seconds in real use; only on request in tests, via `runScheduledJobs`) sends hand-ins held back by grouping. The first hand-in in a minute (`handInGroupingMs`) is sent straight away; later ones are counted and sent as one "N more tickets handed in" once the minute has passed. The count is read and cleared in one statement.
- The screen hears about a scan before the notification is sent, so a slow push service never delays a child's feedback. Notifications for lost tickets are sent in the background too.
- The server now waits for device messages it's already handling before shutting down (this showed up as stray "database already closed" errors in tests).
- The service worker shows notifications (same tag replaces, but still buzzes) and opens the Control Center when one is tapped. The Control Center has a "Notifications on this device" switch; on an iPhone it only works from the installed (home screen) app.
- Not tested end to end with a real push service: headless browsers can't receive web push. Try it on a phone.
