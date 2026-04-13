import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }
}

/**
 * Attach a unique request ID to every incoming request.
 * Uses the X-Request-ID header if present, otherwise generates one.
 */
export function attachRequestId(server: FastifyInstance): void {
  server.addHook(
    'onRequest',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const existing = request.headers['x-request-id'];
      const id =
        typeof existing === 'string' && existing.length > 0
          ? existing
          : nanoid(21);

      request.requestId = id;
      void reply.header('X-Request-ID', id);
    },
  );
}
