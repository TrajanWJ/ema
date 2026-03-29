import { Socket } from "phoenix";
import type { Channel } from "phoenix";

const DAEMON_URL = "ws://localhost:4488/socket";
let socket: Socket | null = null;

export type { Channel };

export function getSocket(): Socket {
  if (!socket) {
    socket = new Socket(DAEMON_URL, { params: {} });
    socket.connect();
  }
  return socket;
}

export function joinChannel(topic: string): Promise<{ channel: Channel; response: unknown }> {
  const channel = getSocket().channel(topic, {});
  return new Promise((resolve, reject) => {
    channel
      .join()
      .receive("ok", (response: unknown) => resolve({ channel, response }))
      .receive("error", (err: unknown) => reject(err))
      .receive("timeout", () => reject(new Error(`Timeout joining ${topic}`)));
  });
}

export function disconnect(): void {
  socket?.disconnect();
  socket = null;
}
