import webpush from "web-push";

/** Where a browser asked us to send its push notifications (from PushManager.subscribe). */
export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** What a grown-up sees: a notification that opens the Control Center at `url` when tapped. */
export interface PushMessage {
  title: string;
  body: string;
  url: string;
  /** Notifications with the same tag replace each other on the device, instead of piling up. */
  tag: string;
}

/**
 * The only way the server sends push notifications, so tests can read what was sent instead. "gone" means the push
 * service says the subscription no longer exists (the app was uninstalled, or notifications were turned off).
 */
export interface PushSender {
  send(subscription: PushSubscription, message: PushMessage): Promise<"sent" | "gone">;
}

/** Sends real web push notifications, signed with our VAPID keys. */
export function webPushSender(vapid: { publicKey: string; privateKey: string; subject: string }): PushSender {
  return {
    async send(subscription, message) {
      try {
        await webpush.sendNotification(subscription, JSON.stringify(message), {
          vapidDetails: vapid,
          TTL: 60 * 60,
        });
        return "sent";
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) return "gone";
        throw error;
      }
    },
  };
}
