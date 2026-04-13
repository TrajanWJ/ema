import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { broadcast } from '../../realtime/server.js';
import { pipeBus } from '../pipes/bus.js';
import {
  createProject,
  getProject,
  getProjectContext,
  listProjects,
  updateProject,
  type CreateProjectInput,
} from './projects.service.js';

interface ProjectParams {
  id: string;
}

export function registerRoutes(app: FastifyInstance): void {
  app.get('/api/projects', async () => {
    return { projects: listProjects() };
  });

  app.get('/api/portfolio/projects', async () => {
    return { projects: listProjects() };
  });

  app.get(
    '/api/projects/:id/context',
    async (
      request: FastifyRequest<{ Params: ProjectParams }>,
      reply: FastifyReply,
    ) => {
      const context = getProjectContext(request.params.id);
      if (!context) {
        return reply.code(404).send({ error: 'project_not_found' });
      }

      return context;
    },
  );

  app.get(
    '/api/projects/:id',
    async (
      request: FastifyRequest<{ Params: ProjectParams }>,
      reply: FastifyReply,
    ) => {
      const project = getProject(request.params.id);
      if (!project) {
        return reply.code(404).send({ error: 'project_not_found' });
      }

      return project;
    },
  );

  app.post(
    '/api/projects',
    async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
      const payload = request.body ?? {};
      if (typeof payload.name !== 'string' || payload.name.trim().length === 0) {
        return reply.code(422).send({ error: 'name_required' });
      }

      const project = createProject({
        name: payload.name,
        slug: typeof payload.slug === 'string' ? payload.slug : undefined,
        description: typeof payload.description === 'string' ? payload.description : null,
        status: typeof payload.status === 'string' ? payload.status : undefined,
        icon: typeof payload.icon === 'string' ? payload.icon : null,
        color: typeof payload.color === 'string' ? payload.color : null,
        linked_path:
          typeof payload.linked_path === 'string' ? payload.linked_path : null,
        parent_id: typeof payload.parent_id === 'string' ? payload.parent_id : null,
      });

      broadcast('projects:lobby', 'project_created', project);
      broadcast(`projects:${project.id}`, 'project_updated', project);
      pipeBus.trigger('projects:created', {
        project_id: project.id,
        status: project.status,
      });

      return { project };
    },
  );

  app.put(
    '/api/projects/:id',
    async (
      request: FastifyRequest<{ Params: ProjectParams; Body: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      const payload = request.body ?? {};
      const update: Partial<CreateProjectInput> = {};
      if (typeof payload.name === 'string') update.name = payload.name;
      if (typeof payload.slug === 'string') update.slug = payload.slug;
      if (typeof payload.description === 'string') update.description = payload.description;
      if (typeof payload.status === 'string') update.status = payload.status;
      if (typeof payload.icon === 'string') update.icon = payload.icon;
      if (typeof payload.color === 'string') update.color = payload.color;
      if (typeof payload.linked_path === 'string') update.linked_path = payload.linked_path;
      if (typeof payload.parent_id === 'string') update.parent_id = payload.parent_id;
      const project = updateProject(request.params.id, update);

      if (!project) {
        return reply.code(404).send({ error: 'project_not_found' });
      }

      broadcast('projects:lobby', 'project_updated', project);
      broadcast(`projects:${project.id}`, 'project_updated', project);
      pipeBus.trigger('projects:status_changed', {
        project_id: project.id,
        status: project.status,
      });

      return { project };
    },
  );
}
