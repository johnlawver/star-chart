import type { WebSocket } from "ws";

/**
 * A device's live connection to the server, as seen from the device:
 * send messages, wait for the next one, or wait for the server to close it.
 */
export class LiveConnection {
  private readonly received: unknown[] = [];
  private waiting: ((message: unknown) => void) | undefined;
  readonly closed: Promise<{ code: number }>;

  constructor(private readonly socket: WebSocket) {
    socket.on("message", (data) => {
      const message = JSON.parse(String(data));
      if (this.waiting) {
        const resolve = this.waiting;
        this.waiting = undefined;
        resolve(message);
      } else {
        this.received.push(message);
      }
    });
    this.closed = new Promise((resolve) => socket.on("close", (code) => resolve({ code })));
  }

  send(message: unknown): void {
    this.socket.send(JSON.stringify(message));
  }

  /** The next message from the server, failing the test if none arrives within a second. */
  nextMessage(): Promise<any> {
    if (this.received.length > 0) return Promise.resolve(this.received.shift());
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no message from the server within 1s")), 1000);
      this.waiting = (message) => {
        clearTimeout(timer);
        resolve(message);
      };
    });
  }

  close(): void {
    this.socket.close();
  }
}
