import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { broadcast } from '../../realtime/server.js';
import { getTodaySnapshot } from '../dashboard/dashboard.service.js';
import { pipeBus } from '../pipes/bus.js';
import { getTask } from '../tasks/tasks.service.js';
import {
  createInboxItem,
  deleteInboxItem,
  listInboxItems,
  promoteInboxItemToTask,
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
      pipeBus.trigger('brain_dump:item_created', item);
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
      pipeBus.trigger('brain_dump:item_processed', item);
      publishDashboardSnapshot();

      return { item };
    },
  );

  app.post(
    '/api/brain-dump/items/:id/task',
    async (
      request: FastifyRequest<{
        Params: InboxParams;
        Body: {
          title?: string;
          description?: string;
          priority?: string | number;
          status?: string;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const promoted = promoteInboxItemToTask(request.params.id, {
        title: typeof request.body?.title === 'string' ? request.body.title : null,
        description:
          typeof request.body?.description === 'string' ? request.body.description : null,
        priority:
          typeof request.body?.priority === 'string' || typeof request.body?.priority === 'number'
            ? request.body.priority
            : null,
        status: typeof request.body?.status === 'string' ? request.body.status : null,
      });

      if (!promoted) {
        return reply.code(404).send({ error: 'item_not_found' });
      }

      broadcast('brain_dump:queue', 'item_processed', promoted.item);
      broadcast('tasks:lobby', 'task_created', promoted.task);
      if (promoted.task.project_id) {
        broadcast(`tasks:${promoted.task.project_id}`, 'task_created', promoted.task);
        broadcast(`projects:${promoted.task.project_id}`, 'task_created', promoted.task);
      }

      pipeBus.trigger('brain_dump:item_processed', promoted.item);
      pipeBus.trigger('tasks:created', {
        task_id: promoted.task.id,
        title: promoted.task.title,
        status: promoted.task.status,
        project_id: promoted.task.project_id,
      });
      publishDashboardSnapshot();

      return {
        item: promoted.item,
        task: getTask(promoted.task.id) ?? promoted.task,
      };
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
