import type { FastifyInstance } from 'fastify';
import { getTodaySnapshot } from './dashboard.service.js';

export function registerRoutes(app: FastifyInstance): void {
  app.get('/api/dashboard/today', async () => getTodaySnapshot());
}
