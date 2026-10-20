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

  add(device: PairedDevice, socket: WebSocket): void {
    this.connections.set(socket, device);
    socket.once("close", () => this.connections.delete(socket));
  }

  /** Registers what to do when a connected device sends a message of a given type, such as a scanner's "scan". */
  on(type: string, handler: MessageHandler): void {
    this.handlers.set(type, handler);
  }

  /** Called with every message a connected device sends after its hello. Unknown messages are ignored. */
  async received(device: PairedDevice, message: Record<string, unknown>): Promise<void> {
    const handler = typeof message.type === "string" ? this.handlers.get(message.type) : undefined;
    await handler?.(device, message);
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

  /** Closes the connections of every part of an observatory, for example when it's unpaired. */
  disconnectObservatory(observatoryId: string): void {
    for (const [socket, device] of this.connections) {
      if (device.observatoryId === observatoryId) socket.close(notPairedCloseCode, "unpaired");
    }
  }
}
