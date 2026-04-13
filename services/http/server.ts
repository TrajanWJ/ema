import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachBearerAuth } from './middleware/auth.js';
import { attachRequestId } from './middleware/request-id.js';
import { activeBackendDomains } from '../core/backend/manifest.js';

const PORT = 4488;
const HOST = '0.0.0.0';

let server: FastifyInstance | undefined;

const startedAt = Date.now();

export async function startHttpServer(): Promise<FastifyInstance> {
  server = Fastify({ logger: false });

  // Plugins
  await server.register(cors, {
    origin: [
      'http://localhost:1420',
      'http://localhost:1421',
      'http://localhost:4488',
      /^https?:\/\/localhost:\d+$/,
    ],
  });

  attachBearerAuth(server);
  attachRequestId(server);

  // Health route (no auth)
  server.get('/api/health', async () => {
    return {
      status: 'ok' as const,
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      version: '0.1.0-electron',
      services: {
        http: 'running',
        websocket: 'running',
      },
    };
  });

  // Register the normalized backend surface from the explicit manifest.
  await registerCoreRouters(server);

  await server.listen({ port: PORT, host: HOST });
  return server;
}

export async function stopHttpServer(): Promise<void> {
  if (server) {
    await server.close();
    server = undefined;
  }
}

export function getServer(): FastifyInstance | undefined {
  return server;
}

async function registerCoreRouters(app: FastifyInstance): Promise<void> {
  const servicesDir = dirname(dirname(fileURLToPath(import.meta.url)));
  const coreDir = join(servicesDir, 'core');

  if (!existsSync(coreDir)) return;

  for (const domain of activeBackendDomains()) {
    // Convention: <domain>.router.ts or router.ts
    const candidates = [
      join(coreDir, domain, `${domain}.router.ts`),
      join(coreDir, domain, `${domain}.router.js`),
      join(coreDir, domain, 'router.ts'),
      join(coreDir, domain, 'router.js'),
    ];

    const found = candidates.find((c) => existsSync(c));
    if (!found) continue;

    try {
      const mod = (await import(found)) as {
        registerRoutes?: (app: FastifyInstance) => void;
      };

      if (typeof mod.registerRoutes === 'function') {
        mod.registerRoutes(app);
      }
    } catch {
      console.warn(`Failed to load router for domain: ${domain}`);
    }
  }
}
