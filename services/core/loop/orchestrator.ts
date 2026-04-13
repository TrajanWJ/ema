import type {
  Artifact,
  CoreExecution,
  CoreIntent,
  CoreProposal,
  CreateCoreIntentInput,
} from "@ema/shared/schemas";
import { executionService } from "../execution/service.js";
import { intentService } from "../intent/service.js";
import { proposalService } from "../proposal/service.js";
import { emitLoopEvent } from "./events.js";
import { runLoopMigrations } from "./migrations.js";

export interface LoopRunResult {
  intent: CoreIntent;
  proposal: CoreProposal;
  execution: CoreExecution;
  artifacts: Artifact[];
}

function buildCompletionSummary(intent: CoreIntent, proposal: CoreProposal): string {
  return [
    `Intent ${intent.id} completed.`,
    `Proposal ${proposal.id} was approved and executed.`,
    `Scope: ${intent.scope.join(", ") || "unspecified"}.`,
  ].join(" ");
}

export class LoopOrchestrator {
  runIntent(input: CreateCoreIntentInput): LoopRunResult {
    runLoopMigrations();
    const createdIntent = intentService.create(input);
    let activeIntent = intentService.updateStatus(createdIntent.id, "active");

    try {
      const proposal = proposalService.generate(activeIntent.id);
      activeIntent = intentService.updateStatus(activeIntent.id, "proposed");

      const approved = proposalService.approve(
        proposal.id,
        activeIntent.requested_by_actor_id,
      );

      const started = executionService.start(approved.id);
      activeIntent = intentService.updateStatus(activeIntent.id, "executing");

      const summary = buildCompletionSummary(activeIntent, approved);
      executionService.recordArtifact(started.id, {
        type: "summary",
        label: "Loop summary",
        content: summary,
        created_by_actor_id: activeIntent.requested_by_actor_id,
        mime_type: "text/plain",
        metadata: { proposal_id: approved.id, intent_id: activeIntent.id },
      });

      const completionResult = {
        summary,
        metadata: { artifact_count: 1 },
      };
      const completed = executionService.complete(started.id, completionResult);
      const finalIntent = intentService.updateStatus(activeIntent.id, "completed");
      const artifacts = executionService.listArtifacts(completed.id);

      emitLoopEvent({
        type: "loop.completed",
        entity_id: completed.id,
        entity_type: "loop",
        payload: {
          intent_id: finalIntent.id,
          proposal_id: approved.id,
          execution_id: completed.id,
          artifact_count: artifacts.length,
        },
      });

      return {
        intent: finalIntent,
        proposal: approved,
        execution: completed,
        artifacts,
      };
    } catch (error) {
      intentService.updateStatus(activeIntent.id, "failed");
      throw error;
    }
  }
}

export const loopOrchestrator = new LoopOrchestrator();
