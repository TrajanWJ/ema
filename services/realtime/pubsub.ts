import { EventEmitter } from 'node:events';

export type PubSubCallback = (event: string, payload: unknown) => void;

export interface PubSub {
  subscribe: (topic: string, callback: PubSubCallback) => void;
  unsubscribe: (topic: string, callback: PubSubCallback) => void;
  publish: (topic: string, event: string, payload: unknown) => void;
}

/**
 * Simple in-process pub/sub backed by EventEmitter.
 * Topics are string keys; each subscription receives (event, payload).
 */
export function createPubSub(): PubSub {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(200);

  function subscribe(topic: string, callback: PubSubCallback): void {
    emitter.on(topic, callback);
  }

  function unsubscribe(topic: string, callback: PubSubCallback): void {
    emitter.off(topic, callback);
  }

  function publish(topic: string, event: string, payload: unknown): void {
    emitter.emit(topic, event, payload);
  }

  return { subscribe, unsubscribe, publish };
}
