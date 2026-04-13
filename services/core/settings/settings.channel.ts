import { registerChannelHandler } from '../../realtime/server.js';
import { getAllSettings, getSetting, upsertSetting } from './settings.service.js';
import { UpsertSettingSchema } from './settings.schema.js';
import { broadcast } from '../../realtime/server.js';

/**
 * Register the "settings:*" channel handler.
 * Handles incoming events from WebSocket clients joined to settings topics.
 */
export function registerSettingsChannel(): void {
  registerChannelHandler('settings:*', (_topic, event, payload, reply) => {
    switch (event) {
      case 'phx_join': {
        reply({});
        return;
      }

      case 'get_all': {
        const settings = getAllSettings();
        reply({ settings });
        return;
      }

      case 'get': {
        const key =
          typeof payload === 'object' &&
          payload !== null &&
          'key' in payload &&
          typeof (payload as Record<string, unknown>)['key'] === 'string'
            ? (payload as Record<string, unknown>)['key'] as string
            : undefined;

        if (!key) {
          reply({ error: 'missing key' });
          return;
        }

        const setting = getSetting(key);
        reply({ setting: setting ?? null });
        return;
      }

      case 'upsert': {
        const parsed = UpsertSettingSchema.safeParse(payload);
        if (!parsed.success) {
          reply({ error: 'validation_failed', details: parsed.error.issues });
          return;
        }

        const setting = upsertSetting(parsed.data);
        broadcast('settings:sync', 'setting_updated', {
          key: setting.key,
          value: setting.value,
        });
        reply({ setting });
        return;
      }

      default: {
        reply({ error: 'unknown_event' });
      }
    }
  });
}
