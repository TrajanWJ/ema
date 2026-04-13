import { ConnectedDraftApp } from "@/components/drafts/ConnectedDraftApp";
import { DRAFT_DEFINITIONS } from "@/components/drafts/draft-definitions";

export function DecisionLogApp() {
  return <ConnectedDraftApp definition={DRAFT_DEFINITIONS["decision-log"]} />;
}
