import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UpsertSettingSchema } from './settings.schema.js';
import { getAllSettings, upsertSetting } from './settings.service.js';
import { broadcast } from '../../realtime/server.js';

export function registerRoutes(app: FastifyInstance): void {
  app.get(
    '/api/settings',
    async (_request: FastifyRequest, _reply: FastifyReply) => {
      const settings = getAllSettings();
      return Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
    },
  );

  app.put(
    '/api/settings',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = UpsertSettingSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(422).send({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
      }

      const setting = upsertSetting(parsed.data);

      // Broadcast change to WebSocket subscribers
      broadcast('settings:sync', 'setting_updated', {
        key: setting.key,
        value: setting.value,
      });

      return setting;
    },
  );
}
