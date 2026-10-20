// The Control Center's service worker: lets it be installed on a phone's home screen, and shows push notifications.
// It doesn't cache anything: Star Chart always needs the live server.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  const message = event.data ? event.data.json() : { title: "Star Chart", body: "", url: "/", tag: "star-chart" };
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      // Replacing a notification with the same tag should still buzz the phone.
      renotify: true,
      icon: "/app-icon-192.png",
      data: { url: message.url },
    }),
  );
});

// Tapping a notification opens the Control Center, reusing an open window if there is one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((window) => new URL(window.url).pathname === new URL(url, self.location.origin).pathname);
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});
