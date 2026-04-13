import type { FastifyInstance } from "fastify";

import { registerReviewRoutes } from "./routes.js";

export function registerRoutes(app: FastifyInstance): void {
  void app.register(
    async (scope) => {
      registerReviewRoutes(scope);
    },
    { prefix: "/api/review" },
  );
}
