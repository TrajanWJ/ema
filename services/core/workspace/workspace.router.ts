import type { FastifyInstance, FastifyRequest } from 'fastify';
import { broadcast } from '../../realtime/server.js';
import { listWindows, upsertWindow } from './workspace.service.js';

interface WorkspaceParams {
  appId: string;
}

function toWindowInput(body: Record<string, unknown>) {
  return {
    is_open: typeof body.is_open === 'boolean' ? body.is_open : undefined,
    x: typeof body.x === 'number' ? body.x : body.x === null ? null : undefined,
    y: typeof body.y === 'number' ? body.y : body.y === null ? null : undefined,
    width:
      typeof body.width === 'number' ? body.width : body.width === null ? null : undefined,
    height:
      typeof body.height === 'number' ? body.height : body.height === null ? null : undefined,
    is_maximized:
      typeof body.is_maximized === 'boolean' ? body.is_maximized : undefined,
  };
}

export function registerRoutes(app: FastifyInstance): void {
  app.get('/api/workspace', async () => {
    return { data: listWindows() };
  });

  app.put(
    '/api/workspace/:appId',
    async (
      request: FastifyRequest<{ Params: WorkspaceParams; Body: Record<string, unknown> }>,
    ) => {
      const windowState = upsertWindow(
        request.params.appId,
        toWindowInput(request.body ?? {}),
      );
      broadcast('workspace:state', 'window_updated', windowState);
      return { data: windowState };
    },
  );
}
