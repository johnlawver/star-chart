// A minimal service worker, so the Control Center can be installed on a phone's home screen.
// It doesn't cache anything: Star Chart always needs the live server. Push notifications arrive in ticket 17.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
