/**
 * VisibilityHub types.
 *
 * The hub tracks "what EMA is doing right now" — a rolling view of active
 * topics (actors, pipes, jobs, intents, executions, composer runs, GAC cards)
 * and a ring buffer of recent state-change events. The renderer's AmbientStrip
 * consumes this stream for its live activity ticker.
 *
 * See `ema-genesis/_meta/SELF-POLLINATION-FINDINGS.md` §A.12 (Hidden Gems)
 * for the recovered pattern from `Ema.Babysitter.VisibilityHub`.
 */

export type TopicKind =
  | 'actor'
  | 'pipe'
  | 'job'
  | 'intent'
  | 'execution'
  | 'composer-run'
  | 'gac-card'
  | 'custom';

export type TopicState =
  | 'starting'
  | 'active'
  | 'idle'
  | 'blocked'
  | 'completed'
  | 'error'
  | 'cancelled';

export type FinalTopicState = 'completed' | 'error' | 'cancelled';

export interface ActiveTopic {
  /** Unique topic id, e.g. "actor:researcher-1" or "pipe:pipe-41:run-42". */
  id: string;
  kind: TopicKind;
  state: TopicState;
  /** Human-readable short description (EMA-VOICE register). */
  label: string;
  /** ISO-8601 timestamp the topic was first registered. */
  startedAt: string;
  /** ISO-8601 timestamp of the most recent mutation. */
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface VisibilityEvent {
  /** Unique event id. */
  eventId: string;
  /** ISO-8601 timestamp the event was emitted. */
  emittedAt: string;
  topicId: string;
  kind: TopicKind;
  state: TopicState;
  prevState?: TopicState;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface TopicFilter {
  kind?: TopicKind;
  state?: TopicState;
}

export type VisibilityEventHandler = (event: VisibilityEvent) => void;

export type Unsubscribe = () => void;
