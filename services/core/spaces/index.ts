/**
 * Spaces subservice — public surface.
 *
 * Answers GAC-007 with the flat MVP variant. Owns the `spaces` and
 * `space_transitions` tables, the lifecycle state machine, and the
 * HTTP + MCP tool surfaces. See `service.ts` for the GAC-007 decision block.
 */

export {
  addMember,
  archiveSpace,
  createSpace,
  getSpace,
  initSpaces,
  InvalidSpaceMutationError,
  listSpaces,
  listTransitions,
  removeMember,
  seedDefaultSpace,
  SpaceMemberExistsError,
  SpaceMemberMissingError,
  SpaceNotFoundError,
  SpaceSlugTakenError,
  spacesEvents,
  type AddMemberInput,
  type ArchiveSpaceInput,
  type CreateSpaceInput,
  type ListSpacesFilter,
  type RemoveMemberInput,
  type SpaceRecord,
  type SpacesEvent,
} from "./service.js";

export { registerSpacesRoutes } from "./routes.js";

export {
  registerSpacesMcpTools,
  spacesMcpTools,
  type SpacesMcpTool,
} from "./mcp-tools.js";

export {
  applySpacesDdl,
  SPACES_DDL,
  spaces,
  spaceTransitions,
} from "./schema.js";

export {
  assertTransition,
  canTransition,
  InvalidSpaceTransitionError,
  SPACE_STATUSES,
  SPACE_TRANSITIONS,
  type SpaceStatus,
  type SpaceTransitionRecord,
} from "./state-machine.js";
