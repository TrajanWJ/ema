import { Socket } from "phoenix";
import type { Channel } from "phoenix";
import { DAEMON_WS_URL, getDaemonAuthToken } from "@/lib/daemon-config";

let socket: Socket | null = null;

export type { Channel };

export function getSocket(): Socket {
  if (!socket) {
    const token = getDaemonAuthToken();
    const params = token ? { api_token: token } : {};

    socket = new Socket(DAEMON_WS_URL, {
      params,
      // Reconnect with exponential backoff — handles cold-start race where
      // Tauri opens the webview before the Phoenix daemon is fully ready.
      reconnectAfterMs: (tries: number) => [500, 1000, 2000, 3000, 5000][Math.min(tries - 1, 4)],
    });
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
