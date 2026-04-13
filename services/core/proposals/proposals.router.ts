/**
 * Proposals domain router — auto-registered by `services/http/server.ts`.
 *
 * Surfaces the seeder and farmer as read-only HTTP endpoints so the
 * renderer (and any other client) can prime the proposal pipeline. The
 * bootstrap is best-effort: if `EMA_VAULT_ROOT` isn't set the GET handlers
 * still respond, they just return an empty list.
 *
 * Writes against `IntentionFarmer.clean` are guarded behind an explicit
 * POST so a stray `curl` can't wipe harvested state.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { IntentionFarmer } from "./intention-farmer.js";
import { VaultSeeder, type VaultSeed } from "./vault-seeder.js";

interface CleanBody {
  dry_run?: boolean;
}

function resolveVaultRoot(): string | null {
  const envRoot = process.env.EMA_VAULT_ROOT;
  if (envRoot && existsSync(envRoot)) return envRoot;

  const xdg = process.env.XDG_DATA_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(process.env.HOME ?? "", ".local/share");
  const candidate = join(base, "ema/vault");
  return existsSync(candidate) ? candidate : null;
}

export function registerRoutes(app: FastifyInstance): void {
  app.get("/api/proposals/seeds", async (): Promise<{ seeds: VaultSeed[] }> => {
    const root = resolveVaultRoot();
    if (!root) return { seeds: [] };
    const seeder = new VaultSeeder({ vaultRoot: root });
    const seeds = await seeder.scan({ limit: 500 });
    return { seeds };
  });

  app.get("/api/proposals/harvested", async () => {
    const root = resolveVaultRoot();
    const farmerOptions: ConstructorParameters<typeof IntentionFarmer>[0] = {};
    if (root) farmerOptions.vaultRoot = root;
    const farmer = new IntentionFarmer(farmerOptions);
    const intents = await farmer.harvest();
    return { intents };
  });

  app.post(
    "/api/proposals/harvested/clean",
    async (
      request: FastifyRequest<{ Body: CleanBody | undefined }>,
      _reply: FastifyReply,
    ) => {
      const dryRun = request.body?.dry_run !== false;
      const farmer = new IntentionFarmer();
      const result = await farmer.clean(dryRun);
      return { ...result, dry_run: dryRun };
    },
  );
}
