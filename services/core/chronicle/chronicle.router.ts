import type { FastifyInstance } from "fastify";

import { registerChronicleRoutes } from "./routes.js";

export function registerRoutes(app: FastifyInstance): void {
  void app.register(
    async (scope) => {
      registerChronicleRoutes(scope);
    },
    { prefix: "/api/chronicle" },
  );
}
