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
import { z } from "zod";

import { IntentionFarmer } from "./intention-farmer.js";
import { VaultSeeder, type VaultSeed } from "./vault-seeder.js";
import {
  ProposalNotFoundError,
  ProposalStateError,
  proposalService,
} from "../proposal/service.js";
import { CoreIntentNotFoundError } from "../intent/service.js";

interface CleanBody {
  dry_run?: boolean;
}

const createProposalBodySchema = z.object({
  intent_id: z.string().min(1),
});

const approveProposalParamsSchema = z.object({
  id: z.string().min(1),
});

const approveProposalBodySchema = z.object({
  actor_id: z.string().min(1).default("actor_human_owner"),
});

function handleProposalError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof CoreIntentNotFoundError) {
    return reply.code(404).send({ error: "intent_not_found", id: err.id });
  }
  if (err instanceof ProposalNotFoundError) {
    return reply.code(404).send({ error: err.code, id: err.id });
  }
  if (err instanceof ProposalStateError) {
    return reply.code(409).send({ error: err.code, detail: err.message });
  }
  if (err instanceof z.ZodError) {
    return reply.code(422).send({ error: "invalid_input", issues: err.issues });
  }
  const detail = err instanceof Error ? err.message : "internal_error";
  return reply.code(500).send({ error: "internal_error", detail });
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
  app.post(
    "/api/proposals",
    async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const body = createProposalBodySchema.parse(request.body ?? {});
        const proposal = proposalService.generate(body.intent_id);
        return reply.code(201).send({ proposal });
      } catch (err) {
        return handleProposalError(reply, err);
      }
    },
  );

  app.post(
    "/api/proposals/:id/approve",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = approveProposalParamsSchema.parse(request.params);
        const body = approveProposalBodySchema.parse(request.body ?? {});
        const proposal = proposalService.approve(id, body.actor_id);
        return { proposal };
      } catch (err) {
        return handleProposalError(reply, err);
      }
    },
  );

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
