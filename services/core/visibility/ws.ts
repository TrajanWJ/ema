import { broadcast, registerChannelHandler } from '../../realtime/server.js';
import { visibilityHub, VisibilityHub } from './hub.js';
import type { VisibilityEvent } from './types.js';

/**
 * Phoenix channel topic the AmbientStrip joins.
 * Kept stable so the renderer can hardcode it.
 */
export const VISIBILITY_TOPIC = 'visibility:stream';

/** The wire event name for a single VisibilityEvent push. */
export const VISIBILITY_EVENT = 'visibility_event';

let attached = false;
let unsubscribeHub: (() => void) | undefined;

/**
 * Wire the VisibilityHub into the existing realtime server.
 *
 * We reuse the Phoenix channel infrastructure rather than standing up our
 * own WebSocket server. On `phx_join` we reply with the last N events as
 * replay; subsequent emissions flow through `broadcast()` which fans out to
 * every socket that joined the topic.
 *
 * Idempotent: calling twice is a no-op. Tests can pass `hub` to attach a
 * separate instance; production code should leave it defaulted.
 */
export function attachVisibilityChannel(
  hub: VisibilityHub = visibilityHub,
): void {
  if (attached) return;
  attached = true;

  registerChannelHandler(VISIBILITY_TOPIC, (_topic, event, _payload, reply) => {
    if (event === 'phx_join') {
      const replay = hub.recentEvents(VisibilityHub.connectReplayDefault);
      reply({ events: replay });
      return;
    }
    // Unknown client-originated event — acknowledge without work.
    reply({});
  });

  unsubscribeHub = hub.subscribe((evt: VisibilityEvent) => {
    broadcast(VISIBILITY_TOPIC, VISIBILITY_EVENT, evt);
  });
}

/** Detach and reset module state. Test-only. */
export function detachVisibilityChannel(): void {
  if (!attached) return;
  unsubscribeHub?.();
  unsubscribeHub = undefined;
  attached = false;
}
