import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { broadcast } from '../../realtime/server.js';
import {
  addTaskComment,
  createTask,
  getTask,
  listTasks,
  transitionTask,
} from './tasks.service.js';

interface TaskParams {
  id: string;
}

interface ProjectTaskParams {
  id: string;
}

interface TaskQuery {
  project_id?: string;
  status?: string;
  priority?: string;
}

function taskPayload(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};
  const data = input as Record<string, unknown>;
  const nested =
    data.task && typeof data.task === 'object' ? (data.task as Record<string, unknown>) : null;
  return nested ?? data;
}

export function registerRoutes(app: FastifyInstance): void {
  app.get(
    '/api/tasks',
    async (request: FastifyRequest<{ Querystring: TaskQuery }>) => {
      const tasks = listTasks({
        projectId: request.query.project_id,
        status: request.query.status,
        priority: request.query.priority,
      });
      return { tasks };
    },
  );

  app.get(
    '/api/projects/:id/tasks',
    async (request: FastifyRequest<{ Params: ProjectTaskParams }>) => {
      return { tasks: listTasks({ projectId: request.params.id }) };
    },
  );

  app.get(
    '/api/tasks/:id',
    async (
      request: FastifyRequest<{ Params: TaskParams }>,
      reply: FastifyReply,
    ) => {
      const task = getTask(request.params.id);
      if (!task) {
        return reply.code(404).send({ error: 'task_not_found' });
      }

      return task;
    },
  );

  app.post(
    '/api/tasks',
    async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
      const payload = taskPayload(request.body);
      if (typeof payload.title !== 'string' || payload.title.trim().length === 0) {
        return reply.code(422).send({ error: 'title_required' });
      }

      const task = createTask({
        title: payload.title,
        description: typeof payload.description === 'string' ? payload.description : null,
        status: typeof payload.status === 'string' ? payload.status : undefined,
        priority:
          typeof payload.priority === 'string' || typeof payload.priority === 'number'
            ? payload.priority
            : undefined,
        source_type: typeof payload.source_type === 'string' ? payload.source_type : null,
        source_id: typeof payload.source_id === 'string' ? payload.source_id : null,
        effort: typeof payload.effort === 'string' ? payload.effort : null,
        due_date: typeof payload.due_date === 'string' ? payload.due_date : null,
        project_id: typeof payload.project_id === 'string' ? payload.project_id : null,
        parent_id: typeof payload.parent_id === 'string' ? payload.parent_id : null,
        agent: typeof payload.agent === 'string' ? payload.agent : null,
        intent: typeof payload.intent === 'string' ? payload.intent : null,
        intent_confidence:
          typeof payload.intent_confidence === 'string' ? payload.intent_confidence : null,
        intent_overridden:
          typeof payload.intent_overridden === 'boolean' ? payload.intent_overridden : null,
      });

      broadcast('tasks:lobby', 'task_created', task);
      if (task.project_id) {
        broadcast(`tasks:${task.project_id}`, 'task_created', task);
        broadcast(`projects:${task.project_id}`, 'task_created', task);
      }

      return task;
    },
  );

  app.post(
    '/api/tasks/:id/transition',
    async (
      request: FastifyRequest<{ Params: TaskParams; Body: { status?: string } }>,
      reply: FastifyReply,
    ) => {
      if (typeof request.body?.status !== 'string') {
        return reply.code(422).send({ error: 'status_required' });
      }

      const task = transitionTask(request.params.id, request.body.status);
      if (!task) {
        return reply.code(404).send({ error: 'task_not_found' });
      }

      broadcast('tasks:lobby', 'task_updated', task);
      if (task.project_id) {
        broadcast(`tasks:${task.project_id}`, 'task_updated', task);
        broadcast(`projects:${task.project_id}`, 'task_updated', task);
      }

      return task;
    },
  );

  app.post(
    '/api/tasks/:id/comments',
    async (
      request: FastifyRequest<{ Params: TaskParams; Body: { body?: string; source?: string } }>,
      reply: FastifyReply,
    ) => {
      if (typeof request.body?.body !== 'string' || request.body.body.trim().length === 0) {
        return reply.code(422).send({ error: 'body_required' });
      }

      const task = getTask(request.params.id);
      if (!task) {
        return reply.code(404).send({ error: 'task_not_found' });
      }

      const comment = addTaskComment(
        request.params.id,
        request.body.body,
        request.body.source === 'system' || request.body.source === 'agent'
          ? request.body.source
          : 'user',
      );

      const updatedTask = getTask(request.params.id) ?? task;
      broadcast('tasks:lobby', 'task_updated', updatedTask);
      if (updatedTask.project_id) {
        broadcast(`tasks:${updatedTask.project_id}`, 'task_updated', updatedTask);
        broadcast(`projects:${updatedTask.project_id}`, 'task_updated', updatedTask);
      }

      return comment;
    },
  );
}
