import type { Worker } from "../src/worker-manager.js";

/**
 * Proposal engine pipeline stages.
 * Each stage is a placeholder that will be wired to the daemon's
 * proposal pipeline or run locally via Claude CLI.
 */

interface Proposal {
  id: string;
  title: string;
  content: string;
  stage: "scheduled" | "generated" | "refined" | "debated" | "tagged";
  confidence?: number;
  tags?: string[];
}

async function schedule(): Promise<Proposal[]> {
  // Check seeds, return proposals ready for generation
  return [];
}

async function generate(proposal: Proposal): Promise<Proposal> {
  // Call Claude to generate proposal content from seed
  return { ...proposal, stage: "generated" };
}

async function refine(proposal: Proposal): Promise<Proposal> {
  // Run critique pass on generated content
  return { ...proposal, stage: "refined" };
}

async function debate(proposal: Proposal): Promise<Proposal> {
  // Steelman / red-team / synthesis pass
  return { ...proposal, stage: "debated", confidence: 0.5 };
}

async function tag(proposal: Proposal): Promise<Proposal> {
  // Auto-assign tags via Claude haiku
  return { ...proposal, stage: "tagged", tags: [] };
}

const PIPELINE = [generate, refine, debate, tag] as const;

export function createProposalEngine(): Worker {
  let running = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function tick(): Promise<void> {
    if (!running) return;

    const scheduled = await schedule();

    for (const proposal of scheduled) {
      let current = proposal;
      for (const stage of PIPELINE) {
        if (!running) return;
        current = await stage(current);
      }
    }
  }

  return {
    name: "proposal-engine",

    async start(): Promise<void> {
      running = true;
      await tick();
      timer = setInterval(() => void tick(), 60_000);
    },

    async stop(): Promise<void> {
      running = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
