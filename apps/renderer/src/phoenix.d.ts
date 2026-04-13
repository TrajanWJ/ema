declare module "phoenix" {
  export class Push {
    receive(status: string, callback: (response: unknown) => void): this;
  }

  export class Channel {
    join(timeout?: number): Push;
    leave(timeout?: number): Push;
    on(event: string, callback: (payload: never) => void): number;
    off(event: string, ref?: number): void;
    push(event: string, payload: Record<string, unknown>, timeout?: number): Push;
    onClose(callback: () => void): void;
    onError(callback: (reason?: string) => void): void;
  }

  export interface SocketConnectOption {
    params?: Record<string, unknown> | (() => Record<string, unknown>);
    transport?: unknown;
    timeout?: number;
    heartbeatIntervalMs?: number;
    longpollHost?: string;
    encode?: (payload: unknown, callback: (encoded: string) => void) => void;
    decode?: (payload: string, callback: (decoded: unknown) => void) => void;
    reconnectAfterMs?: (tries: number) => number;
    rejoinAfterMs?: (tries: number) => number;
    vsn?: string;
  }

  export class Socket {
    constructor(endPoint: string, opts?: SocketConnectOption);
    connect(): void;
    disconnect(callback?: () => void, code?: number, reason?: string): void;
    channel(topic: string, chanParams?: Record<string, unknown>): Channel;
    onOpen(callback: () => void): void;
    onClose(callback: () => void): void;
    onError(callback: (error: unknown) => void): void;
    isConnected(): boolean;
  }
}
