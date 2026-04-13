/**
 * Domain router shim for Fastify auto-registration. See
 * `services/http/server.ts#registerCoreRouters` for the discovery rule —
 * each core domain exposes `<domain>/<domain>.router.ts` with a
 * `registerRoutes(app)` export. The real handlers live in `./routes.ts`.
 */
export { registerRoutes } from "./routes.js";
