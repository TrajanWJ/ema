import { existsSync } from "node:fs";
import { join } from "node:path";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  approveProposalInputSchema,
  createProposalInputSchema,
  listProposalFilterSchema,
  rejectProposalInputSchema,
  reviseCoreProposalInputSchema,
  startProposalExecutionInputSchema,
} from "@ema/shared/schemas";

import { IntentionFarmer } from "../proposals/intention-farmer.js";
import { VaultSeeder, type VaultSeed } from "../proposals/vault-seeder.js";
import {
  ProposalIntentNotFoundError,
  ProposalIntentNotRunnableError,
  ProposalNotFoundError,
  ProposalStateError,
  proposalService,
} from "./service.js";

interface CleanBody {
  dry_run?: boolean;
}

const idParamsSchema = z.object({ id: z.string().min(1) });

function handleProposalError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof ProposalIntentNotFoundError) {
    return reply.code(404).send({ error: err.code, intent_id: err.intentId });
  }
  if (err instanceof ProposalIntentNotRunnableError) {
    return reply.code(409).send({ error: err.code, intent_id: err.intentId });
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
  app.get(
    "/api/proposals",
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      try {
        const filter = listProposalFilterSchema.parse(request.query ?? {});
        return { proposals: proposalService.list(filter) };
      } catch (err) {
        return handleProposalError(reply, err);
      }
    },
  );

  app.get(
    "/api/proposals/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params);
        const proposal = proposalService.get(id);
        if (!proposal) {
          return reply.code(404).send({ error: "proposal_not_found", id });
        }
        return { proposal };
      } catch (err) {
        return handleProposalError(reply, err);
      }
    },
  );

  app.post(
    "/api/proposals",
    async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const body = createProposalInputSchema.parse(request.body ?? {});
        const proposal = proposalService.generate(body.intent_id, {
          ...(body.title ? { title: body.title } : {}),
          ...(body.summary ? { summary: body.summary } : {}),
          ...(body.rationale ? { rationale: body.rationale } : {}),
          ...(body.plan_steps ? { plan_steps: body.plan_steps } : {}),
          ...(body.generated_by_actor_id
            ? { generated_by_actor_id: body.generated_by_actor_id }
            : {}),
          ...(body.metadata ? { metadata: body.metadata } : {}),
        });
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
        const { id } = idParamsSchema.parse(request.params);
        const body = approveProposalInputSchema.parse(request.body ?? {});
        const proposal = proposalService.approve(id, body.actor_id);
        return { proposal };
      } catch (err) {
        return handleProposalError(reply, err);
      }
    },
  );

  app.post(
    "/api/proposals/:id/reject",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params);
        const body = rejectProposalInputSchema.parse(request.body ?? {});
        const proposal = proposalService.reject(id, body.actor_id, body.reason);
        return { proposal };
      } catch (err) {
        return handleProposalError(reply, err);
      }
    },
  );

  app.post(
    "/api/proposals/:id/revise",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params);
        const body = reviseCoreProposalInputSchema.parse(request.body ?? {});
        const proposal = proposalService.revise(id, body);
        return { proposal };
      } catch (err) {
        return handleProposalError(reply, err);
      }
    },
  );

  app.post(
    "/api/proposals/:id/executions",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params);
        const body = startProposalExecutionInputSchema.parse(request.body ?? {});
        const execution = proposalService.startExecution(id, body);
        return reply.code(201).send({ execution });
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
