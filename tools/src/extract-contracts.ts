/**
 * Extract route contracts from the Elixir Phoenix router.
 *
 * Reads IGNORE_OLD_TAURI_BUILD/daemon/lib/ema_web/router.ex and extracts route definitions
 * using regex. The regex approach is intentionally simple — it catches the
 * common `get "/path", Controller, :action` patterns but will miss:
 *   - Routes defined via macros or dynamic generation
 *   - Nested scopes with complex pipe_through chains
 *   - Forward declarations
 *
 * Output needs manual review against `mix phx.routes` for completeness.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

interface RouteContract {
  method: string;
  path: string;
  controller: string;
  action: string;
}

// Matches lines like: get "/tasks", TaskController, :list
// Also handles: post "/tasks/:id/transition", TaskController, :transition
// NOTE: This regex is intentionally simple. It handles ~80% of Phoenix routes
// but will miss forwarded routes, macro-generated routes, and resources/2 expansions.
// Always cross-check against `mix phx.routes` output.
const ROUTE_REGEX =
  /^\s*(get|post|put|patch|delete)\s+"([^"]+)",\s*(\w+),\s*:(\w+)/gm;

const ROUTER_PATH = join(
  process.cwd(),
  "IGNORE_OLD_TAURI_BUILD",
  "daemon",
  "lib",
  "ema_web",
  "router.ex",
);

const OUTPUT_PATH = join(process.cwd(), "tools", "contracts", "routes.json");

async function extractRoutes(): Promise<RouteContract[]> {
  let source = "";
  try {
    source = await readFile(ROUTER_PATH, "utf-8");
  } catch {
    console.error(`Cannot read router at ${ROUTER_PATH}`);
    console.error("Make sure you run this from the repo root.");
    throw new Error(`router_not_found:${ROUTER_PATH}`);
  }

  const routes: RouteContract[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  ROUTE_REGEX.lastIndex = 0;

  while ((match = ROUTE_REGEX.exec(source)) !== null) {
    const [, method, path, controller, action] = match;
    if (method && path && controller && action) {
      routes.push({ method: method.toUpperCase(), path, controller, action });
    }
  }

  return routes;
}

async function main(): Promise<void> {
  console.log(`Reading router from: ${ROUTER_PATH}`);
  const routes = await extractRoutes();

  console.log(`Found ${routes.length} routes`);

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(routes, null, 2) + "\n");

  console.log(`Written to: ${OUTPUT_PATH}`);
  console.log("");
  console.log("WARNING: This output needs manual review.");
  console.log("Run `cd daemon && mix phx.routes` for the authoritative route list.");
}

void main();
