import type { FastifyInstance } from "fastify";

import {
  ACTIVE_BACKEND_ENTITIES,
  BACKEND_DEDUPLICATION_DECISIONS,
  BACKEND_DOMAINS,
  BACKEND_LAYERS,
  BACKEND_STORAGE_BOUNDARIES,
} from "./manifest.js";

export function registerRoutes(app: FastifyInstance): void {
  app.get("/api/backend/manifest", async () => {
    return {
      backend_version: "current-2026-04-13",
      spine:
        "ema-genesis/filesystem canon -> SQLite mirror -> runtime services -> interfaces",
      layers: BACKEND_LAYERS,
      storage: BACKEND_STORAGE_BOUNDARIES,
      domains: BACKEND_DOMAINS,
      entities: ACTIVE_BACKEND_ENTITIES,
      deduplication: BACKEND_DEDUPLICATION_DECISIONS,
    };
  });
}
