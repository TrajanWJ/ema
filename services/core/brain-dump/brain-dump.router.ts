import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { broadcast } from '../../realtime/server.js';
import { getTodaySnapshot } from '../dashboard/dashboard.service.js';
import {
  createInboxItem,
  deleteInboxItem,
  listInboxItems,
  processInboxItem,
} from './brain-dump.service.js';

interface InboxParams {
  id: string;
}

function publishDashboardSnapshot(): void {
  broadcast('dashboard:lobby', 'snapshot', getTodaySnapshot());
}

export function registerRoutes(app: FastifyInstance): void {
  app.get('/api/brain-dump/items', async () => {
    return { items: listInboxItems() };
  });

  app.post(
    '/api/brain-dump/items',
    async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
      const payload = request.body ?? {};
      if (typeof payload.content !== 'string' || payload.content.trim().length === 0) {
        return reply.code(422).send({ error: 'content_required' });
      }

      const item = createInboxItem({
        content: payload.content,
        source: typeof payload.source === 'string' ? payload.source : 'text',
        project_id: typeof payload.project_id === 'string' ? payload.project_id : null,
      });

      broadcast('brain_dump:queue', 'item_created', item);
      publishDashboardSnapshot();

      return { item };
    },
  );

  app.patch(
    '/api/brain-dump/items/:id/process',
    async (
      request: FastifyRequest<{ Params: InboxParams; Body: { action?: string } }>,
      reply: FastifyReply,
    ) => {
      if (typeof request.body?.action !== 'string') {
        return reply.code(422).send({ error: 'action_required' });
      }

      const item = processInboxItem(request.params.id, request.body.action);
      if (!item) {
        return reply.code(404).send({ error: 'item_not_found' });
      }

      broadcast('brain_dump:queue', 'item_processed', item);
      publishDashboardSnapshot();

      return { item };
    },
  );

  app.delete(
    '/api/brain-dump/items/:id',
    async (
      request: FastifyRequest<{ Params: InboxParams }>,
      reply: FastifyReply,
    ) => {
      const deleted = deleteInboxItem(request.params.id);
      if (!deleted) {
        return reply.code(404).send({ error: 'item_not_found' });
      }

      broadcast('brain_dump:queue', 'item_deleted', { id: request.params.id });
      publishDashboardSnapshot();

      return { ok: true };
    },
  );
}
