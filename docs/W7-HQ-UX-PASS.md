W7 HQ UX pass completed.

Updated `app/src/components/superman/HQTab.tsx` to improve information hierarchy and scanability while keeping the existing W7 context contract and project-id channel/refetch wiring intact.

Changes focused on:
- stronger top-level project summary and live status
- clearer attention-first ordering for health, campaign, and blockers
- more compact task, proposal, execution, vault, and reflexion cards
- better empty states and section descriptions for low-data scenarios

Verification:
- `cd app && npm run build` -> passed
- `cd app && npx eslint src/components/superman/HQTab.tsx src/stores/project-store.ts` -> passed
