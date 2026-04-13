import { ConnectedDraftApp } from "@/components/drafts/ConnectedDraftApp";
import { DRAFT_DEFINITIONS } from "@/components/drafts/draft-definitions";

export function TemporalApp() {
  return <ConnectedDraftApp definition={DRAFT_DEFINITIONS.temporal} />;
}
