import { useEffect, useRef, useState } from "react";

const notPairedCloseCode = 4401;

export type LiveStatus = "connecting" | "connected" | "disconnected";

/**
 * Holds a device's live connection to the server (ADR 0003): opened outward, starting with a hello that carries
 * the device's credential, and reopened automatically if it drops. Returns the status and a way to send messages.
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

    const connect = () => {
      setStatus("connecting");
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${location.host}/api/parts/live`);
      socketRef.current = socket;
      socket.onopen = () => socket.send(JSON.stringify({ type: "hello", deviceToken }));
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "welcome") setStatus("connected");
        else handlers.current.onMessage(message);
      };
      socket.onclose = (event) => {
        if (stopped) return;
        if (event.code === notPairedCloseCode) return handlers.current.onUnpaired();
        setStatus("disconnected");
        retry = setTimeout(connect, 3000);
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
