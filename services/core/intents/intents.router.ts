/**
 * Domain router shim for Fastify auto-registration.
 *
 * `services/http/server.ts` auto-loads `<domain>/<domain>.router.ts` and calls
 * `registerRoutes(app)` on the export. Intents' internal routes live in
 * `./routes.ts` and are mounted under `/api/intents` as a sibling of
 * `/api/blueprint`, `/api/tasks`, and `/api/visibility`.
 *
 * On first load the service is initialised (DDL applied, canonical
 * ema-genesis/intents/INT-<SLUG>/README.md files indexed) so the queue comes
 * online warm. GAC-<NNN> files are skipped — those belong to Blueprint.
 */

import type { FastifyInstance } from "fastify";

import {
  defaultIntentSources,
  initIntents,
  loadAllIntents,
  registerIntentsRoutes,
} from "./index.js";

let bootstrapped = false;

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  initIntents();
  try {
    const repoRoot = process.cwd();
    loadAllIntents(defaultIntentSources(repoRoot));
  } catch {
    // Intentionally swallowed: cold-boot indexing is best-effort.
  }
}

export function registerRoutes(app: FastifyInstance): void {
  bootstrap();
  void app.register(
    async (scope) => {
      registerIntentsRoutes(scope);
    },
    { prefix: "/api/intents" },
  );
}
