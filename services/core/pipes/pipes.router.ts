/**
 * Domain router shim for Fastify auto-registration.
 *
 * `services/http/server.ts` auto-loads `<domain>/<domain>.router.ts` and
 * calls `registerRoutes(app)` on the export. This file mounts the pipes
 * routes under `/api/pipes` as a sibling of `/api/blueprint`, and also
 * attaches the executor to the process-wide `pipeBus` on first load so
 * trigger events dispatched by other services fire their pipes.
 *
 * Matches the convention in `services/core/blueprint/blueprint.router.ts`.
 */

import type { FastifyInstance } from "fastify";

import { attachPipeBusExecutor } from "./executor.js";
import { initPipes } from "./service.js";
import { registerPipesRoutes } from "./routes.js";

let bootstrapped = false;

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  initPipes();
  try {
    attachPipeBusExecutor();
  } catch {
    // Non-fatal — executor attachment is best-effort at bootstrap.
  }
}

export function registerRoutes(app: FastifyInstance): void {
  bootstrap();
  void app.register(
    async (scope) => {
      registerPipesRoutes(scope);
    },
    { prefix: "/api/pipes" },
  );
}
