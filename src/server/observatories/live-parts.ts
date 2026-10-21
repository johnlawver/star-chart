import type { WebSocket } from "ws";
import type { PairedDevice } from "./observatories.js";

/** Close code for a connection whose credential isn't (or is no longer) valid. */
export const notPairedCloseCode = 4401;

type MessageHandler = (device: PairedDevice, message: Record<string, unknown>) => void | Promise<void>;

/**
 * The devices (screens, printers, scanners) currently holding a live connection to this server.
 * Other modules send to them through here, and listen for the messages they send.
 */
export class LiveParts {
  private readonly connections = new Map<WebSocket, PairedDevice>();
  private readonly handlers = new Map<string, MessageHandler>();
  private readonly answeredLastPing = new WeakSet<WebSocket>();
  private readonly inFlight = new Set<Promise<void>>();
  private readonly heartbeat: ReturnType<typeof setInterval>;

  /**
   * A device that loses power or Wi-Fi never says goodbye, so every `heartbeatMs` each connection is pinged,
   * and any that didn't answer the previous ping is dropped. Otherwise it would look online, and swallow print jobs.
   */
  constructor(heartbeatMs: number) {
    this.heartbeat = setInterval(() => {
      for (const socket of this.connections.keys()) {
        if (!this.answeredLastPing.has(socket)) {
          socket.terminate();
          continue;
        }
        this.answeredLastPing.delete(socket);
        socket.ping();
      }
    }, heartbeatMs);
    this.heartbeat.unref();
  }

  add(device: PairedDevice, socket: WebSocket): void {
    this.connections.set(socket, device);
    this.answeredLastPing.add(socket);
    socket.on("pong", () => this.answeredLastPing.add(socket));
    socket.once("close", () => this.connections.delete(socket));
  }

  /** Stops the heartbeat, drops every connection, and waits for messages already being handled, when the server shuts down. */
  async stop(): Promise<void> {
    clearInterval(this.heartbeat);
    for (const socket of this.connections.keys()) socket.terminate();
    await Promise.allSettled([...this.inFlight]);
  }

  /** Registers what to do when a connected device sends a message of a given type, such as a scanner's "scan". */
  on(type: string, handler: MessageHandler): void {
    this.handlers.set(type, handler);
  }

  /** Called with every message a connected device sends after its hello. Unknown messages are ignored. */
  async received(device: PairedDevice, message: Record<string, unknown>): Promise<void> {
    const handler = typeof message.type === "string" ? this.handlers.get(message.type) : undefined;
    if (!handler) return;
    // Kept track of, so shutting down can wait for messages already being handled.
    const handling = Promise.resolve(handler(device, message)).finally(() => this.inFlight.delete(handling));
    this.inFlight.add(handling);
    await handling;
  }

  /** Whether a device is holding a live connection right now. */
  isOnline(deviceId: string): boolean {
    for (const device of this.connections.values()) {
      if (device.deviceId === deviceId) return true;
    }
    return false;
  }

  /** Sends a message to an observatory's printer. Returns false if no printer of that observatory is connected. */
  sendToPrinter(observatoryId: string, message: unknown): boolean {
    for (const [socket, device] of this.connections) {
      if (device.observatoryId === observatoryId && device.kind === "printer") {
        socket.send(JSON.stringify(message));
        return true;
      }
    }
    return false;
  }

  /** Sends a message to every connected device of an observatory of the given kind. */
  sendTo(observatoryId: string, kind: PairedDevice["kind"], message: unknown): void {
    for (const [socket, device] of this.connections) {
      if (device.observatoryId === observatoryId && device.kind === kind) socket.send(JSON.stringify(message));
    }
  }

  /** Closes the connections of every device in a chart, for example when the chart is deleted. */
  disconnectChart(chartId: string): void {
    for (const [socket, device] of this.connections) {
      if (device.chartId === chartId) socket.close(notPairedCloseCode, "chart deleted");
    }
  }

  /** Closes the connections of every part of an observatory, for example when it's unpaired. */
  disconnectObservatory(observatoryId: string): void {
    for (const [socket, device] of this.connections) {
      if (device.observatoryId === observatoryId) socket.close(notPairedCloseCode, "unpaired");
    }
  }
}
