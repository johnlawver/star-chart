import type { PushMessage, PushSender, PushSubscription } from "../../src/server/push.js";

/** Keeps every push notification the server "sends", so tests can read them. */
export class FakePushSender implements PushSender {
  readonly sent: { endpoint: string; message: PushMessage }[] = [];
  private readonly gone = new Set<string>();
  private readonly broken = new Set<string>();

  async send(subscription: PushSubscription, message: PushMessage): Promise<"sent" | "gone"> {
    if (this.gone.has(subscription.endpoint)) return "gone";
    if (this.broken.has(subscription.endpoint)) throw new Error("the push service refused this one");
    this.sent.push({ endpoint: subscription.endpoint, message });
    return "sent";
  }

  /** What one device has received, oldest first. */
  to(endpoint: string): PushMessage[] {
    return this.sent.filter((push) => push.endpoint === endpoint).map((push) => push.message);
  }

  /** From now on, sending to this device fails with an unexpected error (say, the push service rejects it). */
  markBroken(endpoint: string): void {
    this.broken.add(endpoint);
  }

  /** From now on, the push service says this device's subscription no longer exists. */
  markGone(endpoint: string): void {
    this.gone.add(endpoint);
  }
}

let deviceCounter = 0;
/** A made-up browser push subscription, as a phone would send it. */
export function fakeSubscription(): PushSubscription {
  deviceCounter += 1;
  return {
    endpoint: `https://push.example.test/device-${Date.now()}-${deviceCounter}`,
    keys: { p256dh: "BTestPublicKey", auth: "TestAuth" },
  };
}
