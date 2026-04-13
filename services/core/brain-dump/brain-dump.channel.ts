import { registerChannelHandler } from '../../realtime/server.js';
import { createInboxItem, deleteInboxItem, listInboxItems, processInboxItem } from './brain-dump.service.js';
import { broadcast } from '../../realtime/server.js';
import { getTodaySnapshot } from '../dashboard/dashboard.service.js';

function publishDashboardSnapshot(): void {
  broadcast('dashboard:lobby', 'snapshot', getTodaySnapshot());
}

export function registerBrainDumpChannel(): void {
  registerChannelHandler('brain_dump:*', (_topic, event, payload, reply) => {
    switch (event) {
      case 'phx_join':
        reply({ items: listInboxItems() });
        return;

      case 'add': {
        const data = (payload ?? {}) as Record<string, unknown>;
        if (typeof data.content !== 'string' || data.content.trim().length === 0) {
          reply({ error: 'content_required' });
          return;
        }

        const item = createInboxItem({
          content: data.content,
          source: typeof data.source === 'string' ? data.source : 'text',
          project_id: typeof data.project_id === 'string' ? data.project_id : null,
        });

        broadcast('brain_dump:queue', 'item_created', item);
        publishDashboardSnapshot();
        reply({ item });
        return;
      }

      case 'process': {
        const data = (payload ?? {}) as Record<string, unknown>;
        if (typeof data.id !== 'string' || typeof data.action !== 'string') {
          reply({ error: 'invalid_process_request' });
          return;
        }

        const item = processInboxItem(data.id, data.action);
        if (!item) {
          reply({ error: 'item_not_found' });
          return;
        }

        broadcast('brain_dump:queue', 'item_processed', item);
        publishDashboardSnapshot();
        reply({ item });
        return;
      }

      case 'delete': {
        const data = (payload ?? {}) as Record<string, unknown>;
        if (typeof data.id !== 'string') {
          reply({ error: 'missing_id' });
          return;
        }

        const deleted = deleteInboxItem(data.id);
        if (!deleted) {
          reply({ error: 'item_not_found' });
          return;
        }

        broadcast('brain_dump:queue', 'item_deleted', { id: data.id });
        publishDashboardSnapshot();
        reply({ ok: true });
        return;
      }

      default:
        reply({ error: 'unknown_event' });
    }
  });
}
