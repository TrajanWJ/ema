import { EventEmitter } from 'node:events';
import { nanoid } from 'nanoid';
import type {
  ActiveTopic,
  FinalTopicState,
  TopicFilter,
  TopicKind,
  TopicState,
  Unsubscribe,
  VisibilityEvent,
  VisibilityEventHandler,
} from './types.js';

const DEFAULT_RING_SIZE = 500;
const DEFAULT_CONNECT_REPLAY = 50;

const EVENT_KEY = 'event';

/**
 * In-memory active-topic store + event ring buffer.
 *
 * Every mutation produces a `VisibilityEvent` that is both appended to the
 * ring buffer and fanned out to subscribers via an internal EventEmitter.
 * There is no persistence — losing process state is an accepted cost at v0.1.
 */
export class VisibilityHub {
  private readonly topics = new Map<string, ActiveTopic>();
  private readonly events: VisibilityEvent[] = [];
  private readonly emitter = new EventEmitter();
  private readonly ringSize: number;

  constructor(options: { ringSize?: number } = {}) {
    const size = options.ringSize ?? DEFAULT_RING_SIZE;
    if (!Number.isFinite(size) || size <= 0) {
      throw new Error('VisibilityHub ringSize must be a positive number');
    }
    this.ringSize = Math.floor(size);
    this.emitter.setMaxListeners(0);
  }

  /** List currently active topics, optionally filtered by kind and/or state. */
  listTopics(filter?: TopicFilter): ActiveTopic[] {
    const all = Array.from(this.topics.values());
    if (!filter) return all;
    return all.filter((t) => {
      if (filter.kind && t.kind !== filter.kind) return false;
      if (filter.state && t.state !== filter.state) return false;
      return true;
    });
  }

  getTopic(id: string): ActiveTopic | undefined {
    return this.topics.get(id);
  }

  /**
   * Register a new topic or re-register an existing one.
   *
   * Re-registering an existing id is treated as an update: the topic keeps
   * its original `startedAt` and only `label`, `state`, `metadata` are
   * refreshed. This keeps callers from having to dedupe on their side.
   */
  startTopic(
    topic: Omit<ActiveTopic, 'startedAt' | 'updatedAt' | 'state'> & {
      state?: TopicState;
    },
    message?: string,
  ): ActiveTopic {
    const now = new Date().toISOString();
    const state: TopicState = topic.state ?? 'starting';
    const existing = this.topics.get(topic.id);

    const next: ActiveTopic = {
      id: topic.id,
      kind: topic.kind,
      label: topic.label,
      state,
      startedAt: existing?.startedAt ?? now,
      updatedAt: now,
      ...(topic.metadata !== undefined ? { metadata: topic.metadata } : {}),
    };

    this.topics.set(next.id, next);
    this.pushEvent({
      topicId: next.id,
      kind: next.kind,
      state,
      ...(existing ? { prevState: existing.state } : {}),
      ...(message !== undefined ? { message } : {}),
      ...(topic.metadata !== undefined ? { metadata: topic.metadata } : {}),
    });

    return next;
  }

  /**
   * Patch an existing topic's state/label/metadata. No-op if the id is
   * unknown; returns the updated topic or undefined.
   */
  updateTopic(
    id: string,
    patch: Partial<Pick<ActiveTopic, 'state' | 'label' | 'metadata'>>,
    message?: string,
  ): ActiveTopic | undefined {
    const current = this.topics.get(id);
    if (!current) return undefined;

    const prevState = current.state;
    const next: ActiveTopic = {
      ...current,
      ...(patch.state !== undefined ? { state: patch.state } : {}),
      ...(patch.label !== undefined ? { label: patch.label } : {}),
      ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
      updatedAt: new Date().toISOString(),
    };

    this.topics.set(id, next);
    this.pushEvent({
      topicId: next.id,
      kind: next.kind,
      state: next.state,
      prevState,
      ...(message !== undefined ? { message } : {}),
      ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
    });

    return next;
  }

  /**
   * Mark a topic terminal and remove it from the active set. The event is
   * still emitted so subscribers see the transition. No-op on unknown id.
   */
  endTopic(
    id: string,
    finalState: FinalTopicState,
    message?: string,
  ): ActiveTopic | undefined {
    const current = this.topics.get(id);
    if (!current) return undefined;

    const prevState = current.state;
    const ended: ActiveTopic = {
      ...current,
      state: finalState,
      updatedAt: new Date().toISOString(),
    };

    this.topics.delete(id);
    this.pushEvent({
      topicId: ended.id,
      kind: ended.kind,
      state: finalState,
      prevState,
      ...(message !== undefined ? { message } : {}),
    });

    return ended;
  }

  /** Subscribe to all future visibility events. Returns an unsubscribe fn. */
  subscribe(handler: VisibilityEventHandler): Unsubscribe {
    this.emitter.on(EVENT_KEY, handler);
    return () => {
      this.emitter.off(EVENT_KEY, handler);
    };
  }

  /**
   * Snapshot of the most recent events, newest last. Defaults to the full
   * ring-buffer size; common call sites use `DEFAULT_CONNECT_REPLAY` (50) on
   * WebSocket connect.
   */
  recentEvents(limit: number = this.ringSize): VisibilityEvent[] {
    const n = Math.max(0, Math.min(limit, this.events.length));
    if (n === 0) return [];
    return this.events.slice(this.events.length - n);
  }

  /** Exposed so the WS adapter can pick a sensible default replay size. */
  static get connectReplayDefault(): number {
    return DEFAULT_CONNECT_REPLAY;
  }

  /** Drop all topics + buffered events. Test-only in practice. */
  reset(): void {
    this.topics.clear();
    this.events.length = 0;
  }

  private pushEvent(
    partial: Omit<VisibilityEvent, 'eventId' | 'emittedAt'>,
  ): VisibilityEvent {
    const event: VisibilityEvent = {
      eventId: nanoid(),
      emittedAt: new Date().toISOString(),
      ...partial,
    };

    this.events.push(event);
    if (this.events.length > this.ringSize) {
      this.events.splice(0, this.events.length - this.ringSize);
    }

    this.emitter.emit(EVENT_KEY, event);
    return event;
  }
}

/** Process-wide singleton. Most callers should use this. */
export const visibilityHub = new VisibilityHub();
