/**
 * Domain router shim for Fastify auto-registration.
 *
 * `services/http/server.ts` auto-loads `<domain>/<domain>.router.ts` and calls
 * `registerRoutes(app)` on the export. The actual routes live in `./routes.ts`
 * — this file just forwards, and also wires the WebSocket channel handler
 * once the HTTP app is up.
 */
export { registerRoutes } from './routes.js';
import { attachVisibilityChannel } from './ws.js';

// Attach the realtime channel the first time this module is imported. The
// realtime server registers handlers in a flat map, so it is safe to call
// before `startWsServer()` runs.
attachVisibilityChannel();
