import type { FastifyInstance } from "fastify";

import { registerIngestionRoutes } from "./routes.js";

export function registerRoutes(app: FastifyInstance): void {
  void app.register(
    async (scope) => {
      registerIngestionRoutes(scope);
    },
    { prefix: "/api/ingestion" },
  );
}
