import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { visibilityHub } from './hub.js';
import type { TopicKind, TopicState } from './types.js';

interface TopicsQuery {
  kind?: string;
  state?: string;
}

interface EventsQuery {
  limit?: string;
}

const VALID_KINDS = new Set<TopicKind>([
  'actor',
  'pipe',
  'job',
  'intent',
  'execution',
  'composer-run',
  'gac-card',
  'custom',
]);

const VALID_STATES = new Set<TopicState>([
  'starting',
  'active',
  'idle',
  'blocked',
  'completed',
  'error',
  'cancelled',
]);

function asKind(v: string | undefined): TopicKind | undefined {
  if (!v) return undefined;
  return VALID_KINDS.has(v as TopicKind) ? (v as TopicKind) : undefined;
}

function asState(v: string | undefined): TopicState | undefined {
  if (!v) return undefined;
  return VALID_STATES.has(v as TopicState) ? (v as TopicState) : undefined;
}

function parseLimit(raw: string | undefined, fallback: number, cap: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, cap);
}

/**
 * Register the VisibilityHub HTTP routes against a Fastify instance.
 *
 * Exposes:
 *   GET /api/visibility/topics?kind=&state=
 *   GET /api/visibility/events?limit=100
 *
 * Error copy follows EMA-VOICE: state the condition, no apology.
 */
export function registerRoutes(app: FastifyInstance): void {
  app.get(
    '/api/visibility/topics',
    async (
      request: FastifyRequest<{ Querystring: TopicsQuery }>,
      reply: FastifyReply,
    ) => {
      const rawKind = request.query.kind;
      const rawState = request.query.state;

      if (rawKind !== undefined && asKind(rawKind) === undefined) {
        return reply.code(422).send({ error: 'invalid_kind' });
      }
      if (rawState !== undefined && asState(rawState) === undefined) {
        return reply.code(422).send({ error: 'invalid_state' });
      }

      const kind = asKind(rawKind);
      const state = asState(rawState);
      const topics = visibilityHub.listTopics({
        ...(kind !== undefined ? { kind } : {}),
        ...(state !== undefined ? { state } : {}),
      });
      return { topics };
    },
  );

  app.get(
    '/api/visibility/events',
    async (request: FastifyRequest<{ Querystring: EventsQuery }>) => {
      const limit = parseLimit(request.query.limit, 100, 500);
      const events = visibilityHub.recentEvents(limit);
      return { events, limit };
    },
  );
}
