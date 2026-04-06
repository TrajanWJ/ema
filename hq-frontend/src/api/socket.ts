type Listener = (payload: any) => void;

class SocketManager {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  public isConnected = false;

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.ws = new WebSocket("ws://localhost:3002");
    this.ws.onopen = () => {
      this.isConnected = true;
      this.emit("connection", { connected: true });
    };
    this.ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.channel) this.emit(payload.channel, payload);
      } catch {
        return;
      }
    };
    this.ws.onclose = () => {
      this.isConnected = false;
      this.emit("connection", { connected: false });
      setTimeout(() => this.connect(), 3000);
    };
    this.ws.onerror = () => {
      return;
    };
  }

  on(event: string, cb: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(cb);
  }

  off(event: string, cb: Listener) {
    this.listeners.get(event)?.delete(cb);
  }

  private emit(event: string, payload: any) {
    this.listeners.get(event)?.forEach((cb) => cb(payload));
  }
}

export const socketManager = new SocketManager();
