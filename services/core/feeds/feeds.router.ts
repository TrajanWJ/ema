import type { FastifyInstance } from "fastify";

import { initFeeds, registerFeedsRoutes } from "./index.js";

let bootstrapped = false;

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  initFeeds();
}

export function registerRoutes(app: FastifyInstance): void {
  bootstrap();
  void app.register(
    async (scope) => {
      registerFeedsRoutes(scope);
    },
    { prefix: "/api/feeds" },
  );
}
