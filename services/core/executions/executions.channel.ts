import { registerChannelHandler } from '../../realtime/server.js';
import {
  approveExecution,
  cancelExecution,
  completeExecution,
  listExecutions,
} from './executions.service.js';
import { broadcast } from '../../realtime/server.js';

export function registerExecutionsChannel(): void {
  registerChannelHandler('executions:*', (topic, event, payload, reply) => {
    switch (event) {
      case 'phx_join':
        if (topic.endsWith(':stream')) {
          reply({});
          return;
        }

        reply({ executions: listExecutions() });
        return;

      case 'approve': {
        const data = (payload ?? {}) as Record<string, unknown>;
        if (typeof data.id !== 'string') {
          reply({ error: 'missing_id' });
          return;
        }

        const execution = approveExecution(data.id);
        if (!execution) {
          reply({ error: 'execution_not_found' });
          return;
        }

        broadcast('executions:all', 'execution_updated', { execution });
        reply({ execution });
        return;
      }

      case 'cancel': {
        const data = (payload ?? {}) as Record<string, unknown>;
        if (typeof data.id !== 'string') {
          reply({ error: 'missing_id' });
          return;
        }

        const execution = cancelExecution(data.id);
        if (!execution) {
          reply({ error: 'execution_not_found' });
          return;
        }

        broadcast('executions:all', 'execution_updated', { execution });
        reply({ execution });
        return;
      }

      case 'complete': {
        const data = (payload ?? {}) as Record<string, unknown>;
        if (typeof data.id !== 'string') {
          reply({ error: 'missing_id' });
          return;
        }

        const execution = completeExecution(
          data.id,
          {
            ...(typeof data.result_summary === 'string'
              ? { result_summary: data.result_summary }
              : {}),
            ...(typeof data.result_path === 'string'
              ? { result_path: data.result_path }
              : {}),
          },
        );
        if (!execution) {
          reply({ error: 'execution_not_found' });
          return;
        }

        broadcast('executions:all', 'execution_completed', { execution });
        reply({ execution });
        return;
      }

      default:
        reply({ error: 'unknown_event' });
    }
  });
}
