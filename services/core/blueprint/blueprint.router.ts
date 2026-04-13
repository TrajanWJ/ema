/**
 * Domain router shim for Fastify auto-registration.
 *
 * `services/http/server.ts` auto-loads `<domain>/<domain>.router.ts` and calls
 * `registerRoutes(app)` on the export. Blueprint's internal routes live in
 * `./routes.ts` and are mounted under `/api/blueprint` as a sibling of
 * `/api/tasks` and `/api/visibility` per DEC-004 §5.
 *
 * We register the inner routes inside a Fastify plugin so the prefix is
 * applied without touching the route definitions themselves. On first load
 * the service is initialised (DDL applied, legacy `ema-genesis/intents/GAC-*`
 * cards indexed) so the queue comes online warm.
 */

import type { FastifyInstance } from "fastify";

import {
  defaultGacSources,
  initBlueprint,
  loadAllGacCards,
  registerBlueprintRoutes,
} from "./index.js";

let bootstrapped = false;

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  initBlueprint();
  // Cold-boot index from the canonical filesystem source. Failures are
  // non-fatal — the service still serves in-memory creates.
  try {
    const repoRoot = process.cwd();
    loadAllGacCards(defaultGacSources(repoRoot));
  } catch {
    // Intentionally swallowed: filesystem bootstrap is best-effort.
  }
}

export function registerRoutes(app: FastifyInstance): void {
  bootstrap();
  void app.register(
    async (scope) => {
      registerBlueprintRoutes(scope);
    },
    { prefix: "/api/blueprint" },
  );
}
