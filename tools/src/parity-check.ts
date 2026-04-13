/**
 * Parity check: compare extracted Elixir routes against Node service routers.
 *
 * Reads the contracts JSON produced by extract-contracts.ts, then scans
 * service router files under services/core/ for matching route patterns.
 * Reports which daemon routes have Node equivalents and overall coverage.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { glob } from "glob";
import chalk from "chalk";

interface RouteContract {
  method: string;
  path: string;
  controller: string;
  action: string;
}

interface ParityResult {
  route: RouteContract;
  found: boolean;
  matchedIn?: string;
}

const CONTRACTS_PATH = join(process.cwd(), "tools", "contracts", "routes.json");

async function loadContracts(): Promise<RouteContract[]> {
  try {
    const raw = await readFile(CONTRACTS_PATH, "utf-8");
    return JSON.parse(raw) as RouteContract[];
  } catch {
    console.error(`Cannot read contracts at ${CONTRACTS_PATH}`);
    console.error("Run `pnpm --filter @ema/tools extract` first.");
    throw new Error(`contracts_not_found:${CONTRACTS_PATH}`);
  }
}

async function loadRouterFiles(): Promise<Map<string, string>> {
  const files = await glob([
    join(process.cwd(), "services", "core", "**", "*.router.ts"),
    join(process.cwd(), "services", "core", "**", "router.ts"),
  ]);

  const contents = new Map<string, string>();
  for (const file of files) {
    const content = await readFile(file, "utf-8");
    contents.set(file, content);
  }

  return contents;
}

function normalizeElixirPath(path: string): string {
  // Convert :param to :param (already compatible)
  // Strip /api prefix if present since Node routers are mounted at /api
  return path.replace(/^\/api/, "");
}

function checkParity(
  contracts: RouteContract[],
  routers: Map<string, string>,
): ParityResult[] {
  return contracts.map((route) => {
    const normalized = normalizeElixirPath(route.path);
    // Look for the path string in any router file
    const methodLower = route.method.toLowerCase();

    for (const [filePath, content] of routers) {
      // Check for patterns like: router.get("/tasks", ...) or .get("/tasks")
      if (
        content.includes(`"${normalized}"`) &&
        content.toLowerCase().includes(methodLower)
      ) {
        return { route, found: true, matchedIn: filePath };
      }
    }

    return { route, found: false };
  });
}

function printReport(results: ParityResult[]): void {
  const found = results.filter((r) => r.found);
  const missing = results.filter((r) => !r.found);
  const total = results.length;
  const coverage = total > 0 ? ((found.length / total) * 100).toFixed(1) : "0.0";

  console.log(chalk.bold("\n=== Route Parity Report ===\n"));
  console.log(`Total daemon routes: ${total}`);
  console.log(`Matched in Node:     ${chalk.green(String(found.length))}`);
  console.log(`Missing in Node:     ${chalk.red(String(missing.length))}`);
  console.log(`Coverage:            ${coverage}%\n`);

  if (missing.length > 0) {
    console.log(chalk.yellow("Missing routes:"));
    for (const r of missing) {
      console.log(`  ${r.route.method} ${r.route.path} (${r.route.controller}#${r.route.action})`);
    }
  }

  if (found.length > 0) {
    console.log(chalk.green("\nMatched routes:"));
    for (const r of found) {
      console.log(`  ${r.route.method} ${r.route.path} → ${r.matchedIn ?? "unknown"}`);
    }
  }
}

async function main(): Promise<void> {
  const contracts = await loadContracts();
  const routers = await loadRouterFiles();

  console.log(`Loaded ${contracts.length} contracts, ${routers.size} router files`);

  const results = checkParity(contracts, routers);
  printReport(results);
}

void main();
