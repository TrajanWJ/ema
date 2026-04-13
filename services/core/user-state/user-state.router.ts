/**
 * Domain router shim for Fastify auto-registration.
 *
 * `services/http/server.ts` auto-loads `<domain>/<domain>.router.ts` and calls
 * `registerRoutes(app)` on the export. UserState's routes live in `./routes.ts`
 * and are mounted under `/api/user-state`.
 *
 * Mirrors `blueprint.router.ts` exactly.
 */

import type { FastifyInstance } from "fastify";

import { initUserState, registerUserStateRoutes } from "./index.js";

let bootstrapped = false;

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  initUserState();
}

export function registerRoutes(app: FastifyInstance): void {
  bootstrap();
  void app.register(
    async (scope) => {
      registerUserStateRoutes(scope);
    },
    { prefix: "/api/user-state" },
  );
}
