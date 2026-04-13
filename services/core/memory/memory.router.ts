/**
 * Memory domain router — auto-loader entrypoint.
 *
 * `services/http/server.ts` discovers this file by convention
 * (`<domain>/<domain>.router.ts`) and invokes `registerRoutes(app)`. We then
 * compose sub-routers for each memory subservice. Today there's only
 * cross-pollination; future memory subservices (facts, events, honcho-style
 * hooks) plug in here too.
 */

import type { FastifyInstance } from "fastify";

import { registerRoutes as registerCrossPollinationShim } from "./cross-pollination.router.js";

export function registerRoutes(app: FastifyInstance): void {
  registerCrossPollinationShim(app);
}
