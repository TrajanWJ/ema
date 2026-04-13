/**
 * MCP tool registrations for the Spaces subservice.
 *
 * Mirrors `blueprint/mcp-tools.ts`: exports a `SpacesMcpTool` interface, a
 * `spacesMcpTools` array, and a `registerSpacesMcpTools` placeholder so the
 * caller has a single import whether or not the host registry is wired yet.
 *
 * Tools:
 *   - spaces_list
 *   - spaces_show
 *   - spaces_create
 *   - spaces_archive
 *   - spaces_add_member
 *   - spaces_remove_member
 */

import { z } from "zod";

import { spaceMemberSchema } from "@ema/shared/schemas";
import {
  addMember,
  archiveSpace,
  createSpace,
  getSpace,
  listSpaces,
  listTransitions,
  removeMember,
} from "./service.js";
import { SPACE_STATUSES } from "./state-machine.js";

export interface SpacesMcpTool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (input: unknown) => Promise<unknown> | unknown;
}

const statusEnum = z.enum(SPACE_STATUSES);

const listInput = z.object({
  status: statusEnum.optional(),
  include_archived: z.boolean().optional(),
});

const showInput = z.object({ ref: z.string().min(1) });

const createInput = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/u),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  members: z.array(spaceMemberSchema).optional(),
  settings: z.record(z.unknown()).optional(),
  actor: z.string().default("agent"),
  activate: z.boolean().optional(),
});

const archiveInput = z.object({
  ref: z.string().min(1),
  actor: z.string().default("agent"),
  reason: z.string().optional(),
});

const addMemberInput = z.object({
  ref: z.string().min(1),
  actor: z.string().default("agent"),
  member: spaceMemberSchema,
});

const removeMemberInput = z.object({
  ref: z.string().min(1),
  actor: z.string().default("agent"),
  actor_id: z.string().min(1),
});

export const spacesMcpTools: readonly SpacesMcpTool[] = [
  {
    name: "spaces_list",
    description:
      "List spaces in the flat namespace. Optional filters: status, include_archived.",
    inputSchema: listInput,
    handler: (raw) => {
      const input = listInput.parse(raw ?? {});
      return { spaces: listSpaces(input) };
    },
  },
  {
    name: "spaces_show",
    description:
      "Fetch a single space by id or slug, with its transition history.",
    inputSchema: showInput,
    handler: (raw) => {
      const { ref } = showInput.parse(raw);
      const space = getSpace(ref);
      if (!space) return { error: "space_not_found", ref };
      return { space, transitions: listTransitions(space.id) };
    },
  },
  {
    name: "spaces_create",
    description:
      "Create a new space in the flat namespace. Slugs must be unique and kebab-case.",
    inputSchema: createInput,
    handler: (raw) => {
      const input = createInput.parse(raw);
      const space = createSpace({
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        actor: input.actor,
        ...(input.members !== undefined ? { members: input.members } : {}),
        ...(input.settings !== undefined ? { settings: input.settings } : {}),
        ...(input.activate !== undefined ? { activate: input.activate } : {}),
      });
      return { space };
    },
  },
  {
    name: "spaces_archive",
    description:
      "Archive a space. Archival is terminal — archived spaces reject further member changes.",
    inputSchema: archiveInput,
    handler: (raw) => {
      const input = archiveInput.parse(raw);
      const space = archiveSpace(input.ref, {
        actor: input.actor,
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
      });
      return { space };
    },
  },
  {
    name: "spaces_add_member",
    description:
      "Add an actor to a space with a role (owner | member | viewer). Default role: member.",
    inputSchema: addMemberInput,
    handler: (raw) => {
      const input = addMemberInput.parse(raw);
      const space = addMember(input.ref, {
        actor: input.actor,
        member: input.member,
      });
      return { space };
    },
  },
  {
    name: "spaces_remove_member",
    description: "Remove an actor from a space by actor_id.",
    inputSchema: removeMemberInput,
    handler: (raw) => {
      const input = removeMemberInput.parse(raw);
      const space = removeMember(input.ref, {
        actor: input.actor,
        actor_id: input.actor_id,
      });
      return { space };
    },
  },
];

export function registerSpacesMcpTools(): readonly SpacesMcpTool[] {
  return spacesMcpTools;
}
