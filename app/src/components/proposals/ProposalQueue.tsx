import { useProposalsStore } from "@/stores/proposals-store";
import { ProposalCard } from "./ProposalCard";

export function ProposalQueue() {
  const proposals = useProposalsStore((s) => s.proposals);
  const queued = proposals.filter((p) => p.status === "queued" || p.status === "reviewing");

  if (queued.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <span
          className="text-[0.75rem]"
          style={{ color: "var(--pn-text-muted)" }}
        >
          No proposals in queue
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {queued.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} />
      ))}
    </div>
  );
}
