import type { WebSocket } from "ws";
import type { PairedDevice } from "./observatories.js";

/** Close code for a connection whose credential isn't (or is no longer) valid. */
export const notPairedCloseCode = 4401;

/** The printers and scanners currently holding a live connection to this server. */
export class LiveParts {
  private readonly connections = new Map<WebSocket, PairedDevice>();

  add(device: PairedDevice, socket: WebSocket): void {
    this.connections.set(socket, device);
    socket.once("close", () => this.connections.delete(socket));
  }

  /** Closes the connections of every part of an observatory, for example when it's unpaired. */
  disconnectObservatory(observatoryId: string): void {
    for (const [socket, device] of this.connections) {
      if (device.observatoryId === observatoryId) socket.close(notPairedCloseCode, "unpaired");
    }
  }
}
