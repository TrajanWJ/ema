import { broadcast, registerChannelHandler } from '../../realtime/server.js';

export function registerVoiceChannel(): void {
  registerChannelHandler('voice_remote:*', (topic, event, payload, reply) => {
    switch (event) {
      case 'phx_join':
        reply({ joined: true, topic });
        return;

      case 'phone:ready':
        broadcast(topic, 'phone:ready', {
          connected_at: new Date().toISOString(),
        });
        reply({ ok: true });
        return;

      case 'phone:left':
        broadcast(topic, 'phone:left', {
          disconnected_at: new Date().toISOString(),
        });
        reply({ ok: true });
        return;

      case 'desktop:state': {
        const data = payload && typeof payload === 'object'
          ? payload
          : { state: 'idle' };
        broadcast(topic, 'desktop:state', data);
        reply({ ok: true });
        return;
      }

      case 'mic:chunk': {
        const data = (payload ?? {}) as { data?: unknown; mimeType?: unknown };
        if (typeof data.data !== 'string' || data.data.length === 0) {
          reply({ error: 'missing_audio_chunk' });
          return;
        }

        broadcast(topic, 'phone:mic_chunk', {
          data: data.data,
          mimeType:
            typeof data.mimeType === 'string' && data.mimeType.length > 0
              ? data.mimeType
              : 'audio/webm',
        });
        reply({ ok: true });
        return;
      }

      case 'mic:finish':
        broadcast(topic, 'phone:mic_finish', {
          finished_at: new Date().toISOString(),
        });
        reply({ ok: true });
        return;

      default:
        reply({ error: 'unknown_event' });
    }
  });
}
