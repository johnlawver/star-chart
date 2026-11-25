import { useEffect, useRef, useState } from "react";
import { backoffMs } from "./backoff.js";

const notPairedCloseCode = 4401;

export type LiveStatus = "connecting" | "connected" | "disconnected";

/**
 * Holds a device's live connection to the server (ADR 0003): opened outward, starting with a hello that carries
 * the device's credential, and reopened automatically if it drops: after about 1 s, then waiting longer each time it
 * fails, up to 30 s, so a server that's away for a while isn't hammered. Returns the status and a way to send messages.
 */
export function useLiveConnection(
  deviceToken: string,
  onMessage: (message: any) => void,
  onUnpaired: () => void,
): { status: LiveStatus; send: (message: unknown) => void } {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const socketRef = useRef<WebSocket | undefined>(undefined);
  const handlers = useRef({ onMessage, onUnpaired });
  handlers.current = { onMessage, onUnpaired };

  useEffect(() => {
    let retry: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let failures = 0;

    const connect = () => {
      setStatus("connecting");
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${location.host}/api/parts/live`);
      socketRef.current = socket;
      socket.onopen = () => socket.send(JSON.stringify({ type: "hello", deviceToken }));
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "welcome") {
          failures = 0;
          setStatus("connected");
        }
        else handlers.current.onMessage(message);
      };
      socket.onclose = (event) => {
        if (stopped) return;
        if (event.code === notPairedCloseCode) return handlers.current.onUnpaired();
        setStatus("disconnected");
        retry = setTimeout(connect, backoffMs(failures++));
      };
    };
    connect();

    return () => {
      stopped = true;
      clearTimeout(retry);
      socketRef.current?.close();
    };
  }, [deviceToken]);

  return { status, send: (message) => socketRef.current?.send(JSON.stringify(message)) };
}
