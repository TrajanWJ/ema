import { describe, expect, it, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { VisibilityHub } from './hub.js';
import { registerRoutes } from './routes.js';
import type { VisibilityEvent } from './types.js';

describe('VisibilityHub', () => {
  let hub: VisibilityHub;

  beforeEach(() => {
    hub = new VisibilityHub({ ringSize: 10 });
  });

  it('starts a topic in the default state and makes it listable', () => {
    hub.startTopic({
      id: 'actor:researcher-1',
      kind: 'actor',
      label: 'Researcher drafting brief',
    });

    const topics = hub.listTopics();
    expect(topics).toHaveLength(1);
    const [t] = topics;
    expect(t?.id).toBe('actor:researcher-1');
    expect(t?.state).toBe('starting');
    expect(t?.startedAt).toBe(t?.updatedAt);

    const fetched = hub.getTopic('actor:researcher-1');
    expect(fetched?.kind).toBe('actor');
  });

  it('filters topics by kind and state', () => {
    hub.startTopic({ id: 'actor:a', kind: 'actor', label: 'A', state: 'active' });
    hub.startTopic({ id: 'pipe:b', kind: 'pipe', label: 'B', state: 'active' });
    hub.startTopic({ id: 'actor:c', kind: 'actor', label: 'C', state: 'idle' });

    expect(hub.listTopics({ kind: 'actor' })).toHaveLength(2);
    expect(hub.listTopics({ state: 'active' })).toHaveLength(2);
    expect(
      hub.listTopics({ kind: 'actor', state: 'active' }).map((t) => t.id),
    ).toEqual(['actor:a']);
  });

  it('updateTopic emits a prevState and refreshes updatedAt', async () => {
    hub.startTopic({ id: 'job:sync', kind: 'job', label: 'Sync', state: 'active' });

    const seen: VisibilityEvent[] = [];
    hub.subscribe((e) => seen.push(e));

    // Ensure updatedAt moves forward even when the clock ticks fast.
    await new Promise((r) => setTimeout(r, 5));
    const updated = hub.updateTopic('job:sync', { state: 'blocked' }, 'waiting on lock');

    expect(updated?.state).toBe('blocked');
    expect(seen).toHaveLength(1);
    expect(seen[0]?.prevState).toBe('active');
    expect(seen[0]?.state).toBe('blocked');
    expect(seen[0]?.message).toBe('waiting on lock');
  });

  it('endTopic removes the topic from the active set but still emits', () => {
    hub.startTopic({ id: 'execution:e1', kind: 'execution', label: 'E1', state: 'active' });
    const handler = vi.fn();
    hub.subscribe(handler);

    const ended = hub.endTopic('execution:e1', 'completed', 'done');
    expect(ended?.state).toBe('completed');
    expect(hub.getTopic('execution:e1')).toBeUndefined();
    expect(hub.listTopics()).toHaveLength(0);
    expect(handler).toHaveBeenCalledTimes(1);
    const arg = handler.mock.calls[0]?.[0] as VisibilityEvent;
    expect(arg.prevState).toBe('active');
    expect(arg.state).toBe('completed');
  });

  it('ring buffer evicts oldest events beyond capacity', () => {
    for (let i = 0; i < 25; i += 1) {
      hub.startTopic({ id: `job:${i}`, kind: 'job', label: `Job ${i}` });
    }

    const recent = hub.recentEvents();
    // ringSize for this hub is 10.
    expect(recent).toHaveLength(10);
    const lastMeta = recent[recent.length - 1];
    expect(lastMeta?.topicId).toBe('job:24');
    expect(recent[0]?.topicId).toBe('job:15');
  });

  it('subscribe returns an unsubscribe that stops further events', () => {
    const handler = vi.fn();
    const off = hub.subscribe(handler);
    hub.startTopic({ id: 'job:x', kind: 'job', label: 'X' });
    expect(handler).toHaveBeenCalledTimes(1);
    off();
    hub.updateTopic('job:x', { state: 'active' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('updateTopic on an unknown id is a no-op', () => {
    const handler = vi.fn();
    hub.subscribe(handler);
    const result = hub.updateTopic('nope', { state: 'active' });
    expect(result).toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('recentEvents(limit) returns the tail slice newest-last', () => {
    hub.startTopic({ id: 'a', kind: 'custom', label: 'a' });
    hub.startTopic({ id: 'b', kind: 'custom', label: 'b' });
    hub.startTopic({ id: 'c', kind: 'custom', label: 'c' });

    const last2 = hub.recentEvents(2);
    expect(last2.map((e) => e.topicId)).toEqual(['b', 'c']);
  });
});

describe('visibility routes', () => {
  it('GET /api/visibility/topics and /events return the hub state', async () => {
    // The routes module reads the singleton `visibilityHub`. Import it fresh
    // so this test isolates against test ordering.
    const { visibilityHub } = await import('./hub.js');
    visibilityHub.reset();
    visibilityHub.startTopic({
      id: 'actor:writer',
      kind: 'actor',
      label: 'Writer composing reply',
      state: 'active',
    });

    const app = Fastify({ logger: false });
    registerRoutes(app);
    await app.ready();

    const topicsRes = await app.inject({ method: 'GET', url: '/api/visibility/topics' });
    expect(topicsRes.statusCode).toBe(200);
    const topicsBody = topicsRes.json() as { topics: Array<{ id: string }> };
    expect(topicsBody.topics.map((t) => t.id)).toContain('actor:writer');

    const filtered = await app.inject({
      method: 'GET',
      url: '/api/visibility/topics?kind=actor&state=active',
    });
    expect(filtered.statusCode).toBe(200);
    expect((filtered.json() as { topics: unknown[] }).topics).toHaveLength(1);

    const invalid = await app.inject({
      method: 'GET',
      url: '/api/visibility/topics?kind=bogus',
    });
    expect(invalid.statusCode).toBe(422);

    const eventsRes = await app.inject({
      method: 'GET',
      url: '/api/visibility/events?limit=5',
    });
    expect(eventsRes.statusCode).toBe(200);
    const eventsBody = eventsRes.json() as { events: unknown[]; limit: number };
    expect(eventsBody.limit).toBe(5);
    expect(Array.isArray(eventsBody.events)).toBe(true);

    await app.close();
    visibilityHub.reset();
  });
});
