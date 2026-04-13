import { registerChannelHandler } from '../../realtime/server.js';
import { listWindows, upsertWindow } from './workspace.service.js';
import { broadcast } from '../../realtime/server.js';

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

export function registerWorkspaceChannel(): void {
  registerChannelHandler('workspace:*', (_topic, event, payload, reply) => {
    switch (event) {
      case 'phx_join':
        reply({ windows: listWindows() });
        return;

      case 'update_window': {
        const data = (payload ?? {}) as Record<string, unknown>;
        const appId =
          typeof data.app_id === 'string'
            ? data.app_id
            : typeof data.appId === 'string'
              ? data.appId
              : null;

        if (!appId) {
          reply({ error: 'missing_app_id' });
          return;
        }

        const windowState = upsertWindow(appId, toWindowInput(data));
        broadcast('workspace:state', 'window_updated', windowState);
        reply({ window: windowState });
        return;
      }

      default:
        reply({ error: 'unknown_event' });
    }
  });
}
