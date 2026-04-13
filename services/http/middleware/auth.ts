import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const API_TOKEN = process.env['EMA_API_TOKEN']?.trim() ?? '';

function queryToken(request: FastifyRequest): string | null {
  const url = request.raw.url ?? '';
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  if (!query) return null;
  const params = new URLSearchParams(query);
  return params.get('api_token') || params.get('token');
}

/**
 * Attach bearer auth checking to a Fastify instance.
 * Skips auth for /api/health and WebSocket upgrade requests.
 */
export function attachBearerAuth(server: FastifyInstance): void {
  server.addHook(
    'onRequest',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (API_TOKEN.length === 0) return;

      // Skip auth for health checks
      if (request.url === '/api/health') return;

      // Skip auth for WebSocket upgrade requests
      if (request.headers['upgrade']?.toLowerCase() === 'websocket') return;

      const authHeader = request.headers['authorization'];
      const tokenFromQuery = queryToken(request);

      if (
        (request.method === 'GET' || request.method === 'HEAD') &&
        tokenFromQuery &&
        tokenFromQuery === API_TOKEN
      ) {
        return;
      }

      if (!authHeader) {
        return reply.code(401).send({ error: 'Missing Authorization header' });
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return reply
          .code(401)
          .send({ error: 'Invalid Authorization format, expected Bearer <token>' });
      }

      if (parts[1] !== API_TOKEN) {
        return reply.code(403).send({ error: 'Invalid token' });
      }
    },
  );
}
