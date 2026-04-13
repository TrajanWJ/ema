import type { FastifyInstance } from "fastify";

import { initHumanOps, registerHumanOpsRoutes } from "./index.js";

let bootstrapped = false;

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  initHumanOps();
}

export function registerRoutes(app: FastifyInstance): void {
  bootstrap();
  void app.register(
    async (scope) => {
      registerHumanOpsRoutes(scope);
    },
    { prefix: "/api/human-ops" },
  );
}
