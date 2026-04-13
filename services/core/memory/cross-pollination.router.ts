/**
 * Cross-pollination router shim.
 *
 * Mounts `./cross-pollination.routes.ts` under `/api/memory/cross-pollination`
 * inside a Fastify plugin so the prefix is applied without touching the route
 * handlers themselves. Service DDL is applied on first load.
 *
 * NOTE ON AUTO-LOADING: `services/http/server.ts` auto-loads
 * `<domain>/<domain>.router.ts`, where domain is the directory name. For the
 * `memory/` directory that means `memory.router.ts`. This file exports the
 * same `registerRoutes` contract so it can be composed from the memory
 * auto-loader entry (see `memory.router.ts`).
 */

import type { FastifyInstance } from "fastify";

import { initCrossPollination } from "./cross-pollination.js";
import { registerCrossPollinationRoutes } from "./cross-pollination.routes.js";

let bootstrapped = false;

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  try {
    initCrossPollination();
  } catch {
    // Non-fatal: the service will retry init on first real call.
  }
}

export function registerRoutes(app: FastifyInstance): void {
  bootstrap();
  void app.register(
    async (scope) => {
      registerCrossPollinationRoutes(scope);
    },
    { prefix: "/api/memory/cross-pollination" },
  );
}
