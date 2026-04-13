import { registerChannelHandler } from '../../realtime/server.js';
import { getTodaySnapshot } from './dashboard.service.js';

export function registerDashboardChannel(): void {
  registerChannelHandler('dashboard:*', (_topic, event, _payload, reply) => {
    switch (event) {
      case 'phx_join':
        reply(getTodaySnapshot());
        return;

      default:
        reply({ error: 'unknown_event' });
    }
  });
}
