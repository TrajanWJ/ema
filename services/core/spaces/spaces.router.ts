/**
 * Domain router shim for Fastify auto-registration.
 *
 * Mirrors `blueprint/blueprint.router.ts` exactly: `services/http/server.ts`
 * auto-loads `<domain>/<domain>.router.ts` and calls `registerRoutes(app)` on
 * the export. Inner routes live in `./routes.ts` and are mounted under
 * `/api/spaces`.
 *
 * On first load the service is initialised (DDL applied, default `personal`
 * space seeded) so the namespace is warm before any request lands.
 */

import type { FastifyInstance } from "fastify";

import { initSpaces, registerSpacesRoutes } from "./index.js";

let bootstrapped = false;

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  initSpaces();
}

export function registerRoutes(app: FastifyInstance): void {
  bootstrap();
  void app.register(
    async (scope) => {
      registerSpacesRoutes(scope);
    },
    { prefix: "/api/spaces" },
  );
}
