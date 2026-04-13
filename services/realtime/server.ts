import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import { getServer } from '../http/server.js';
import type { PubSub, PubSubCallback } from './pubsub.js';

/** Phoenix wire protocol: [joinRef, ref, topic, event, payload] */
type PhxMessage = [string | null, string | null, string, string, unknown];

interface ClientState {
  joinedTopics: Map<string, PubSubCallback>;
}

type ChannelHandler = (
  topic: string,
  event: string,
  payload: unknown,
  reply: (response: unknown) => void,
) => void;

let wss: WebSocketServer | undefined;
let pubsub: PubSub | undefined;

const clients = new WeakMap<WebSocket, ClientState>();
const channelHandlers = new Map<string, ChannelHandler>();

export function registerChannelHandler(
  topicPattern: string,
  handler: ChannelHandler,
): void {
  channelHandlers.set(topicPattern, handler);
}

function findHandler(topic: string): ChannelHandler | undefined {
  if (channelHandlers.has(topic)) return channelHandlers.get(topic);
  for (const [pattern, handler] of channelHandlers) {
    if (pattern.endsWith(':*') && topic.startsWith(pattern.slice(0, -1)))
      return handler;
  }
  return undefined;
}

function sendMessage(ws: WebSocket, msg: PhxMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function handleMessage(ws: WebSocket, raw: string): void {
  let msg: PhxMessage;
  try {
    msg = JSON.parse(raw) as PhxMessage;
  } catch {
    return;
  }

  if (!Array.isArray(msg) || msg.length !== 5) return;

  const [joinRef, ref, topic, event, payload] = msg;
  const state = clients.get(ws);
  if (!state) return;

  const reply = (response: unknown): void => {
    sendMessage(ws, [joinRef, ref, topic, 'phx_reply', { status: 'ok', response }]);
  };

  switch (event) {
    case 'heartbeat': {
      sendMessage(ws, [null, ref, 'phoenix', 'phx_reply', { status: 'ok', response: {} }]);
      return;
    }

    case 'phx_join': {
      const handler = findHandler(topic);
      if (!handler) {
        sendMessage(ws, [joinRef, ref, topic, 'phx_reply', { status: 'error', response: { error: 'no_handler' } }]);
        return;
      }

      const callback: PubSubCallback = (evt, pl) => {
        sendMessage(ws, [null, null, topic, evt, pl]);
      };
      state.joinedTopics.set(topic, callback);
      pubsub?.subscribe(topic, callback);
      handler(topic, 'phx_join', payload, reply);
      return;
    }

    case 'phx_leave': {
      const cb = state.joinedTopics.get(topic);
      if (cb) {
        pubsub?.unsubscribe(topic, cb);
        state.joinedTopics.delete(topic);
      }
      reply({});
      return;
    }

    default: {
      const handler = findHandler(topic);
      if (handler) {
        handler(topic, event, payload, reply);
      } else {
        reply({ error: 'no_handler' });
      }
    }
  }
}

function cleanupClient(ws: WebSocket): void {
  const state = clients.get(ws);
  if (!state) return;

  for (const [topic, cb] of state.joinedTopics) {
    pubsub?.unsubscribe(topic, cb);
  }
  state.joinedTopics.clear();
  clients.delete(ws);
}

export function startWsServer(ps: PubSub): void {
  pubsub = ps;
  const httpServer = getServer()?.server;
  if (!httpServer) throw new Error('HTTP server must be started before WebSocket server');

  wss = new WebSocketServer({ server: httpServer, path: '/socket/websocket' });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    clients.set(ws, { joinedTopics: new Map() });

    ws.on('message', (data) => {
      handleMessage(ws, data.toString());
    });

    ws.on('close', () => cleanupClient(ws));
    ws.on('error', () => cleanupClient(ws));
  });
}

export function stopWsServer(): void {
  if (wss) {
    for (const client of wss.clients) {
      client.close();
    }
    wss.close();
    wss = undefined;
  }
}

export function broadcast(topic: string, event: string, payload: unknown): void {
  pubsub?.publish(topic, event, payload);
}
