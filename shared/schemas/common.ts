import { z } from "zod";

export const idSchema = z.string().min(1);

export const timestampSchema = z.string().datetime();

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  per_page: z.number().int().min(1).max(100).default(20),
});

export const baseEntitySchema = z.object({
  id: idSchema,
  inserted_at: timestampSchema,
  updated_at: timestampSchema,
});

export type PaginationOpts = z.infer<typeof paginationSchema>;

/**
 * Typed edge grammar — GAC-005 resolution [C].
 *
 * Every node in the graph may carry an `ema_links` array as an additive field.
 * The primary declaration form is YAML frontmatter in markdown:
 *
 *   ema-links:
 *     - { type: fulfills,     target: "[[INT-001]]" }
 *     - { type: blocks,       target: "[[INT-007]]" }
 *     - { type: derived_from, target: "[[CANON-AGENT-RUNTIME]]" }
 *
 * Inline `[[type::target]]` is syntactic sugar parsed by the second-pass
 * indexer (not yet built). Both forms resolve to the same row in the
 * canonical `edges` table once the Object Index exists.
 *
 * Edge type set is locked by DEC-001 plus the `aspiration_of` addition
 * locked by DEC-003. Inverse edges (`fulfilled_by`, `blocked_by`, etc.)
 * are maintained in code, not persisted.
 */
export const emaLinkTypeSchema = z.enum([
  "fulfills",
  "blocks",
  "derived_from",
  "references",
  "supersedes",
  "aspiration_of",
]);
export type EmaLinkType = z.infer<typeof emaLinkTypeSchema>;

export const emaLinkSchema = z.object({
  type: emaLinkTypeSchema,
  target: z.string().min(1),
});
export type EmaLink = z.infer<typeof emaLinkSchema>;

/**
 * Optional `ema_links` field reused by every node schema that extends
 * `baseEntitySchema`. Kept as a separate exported helper so schemas opt in
 * by `.extend({ ema_links: emaLinksField })` without repeating the type.
 */
export const emaLinksField = z.array(emaLinkSchema).optional();

/**
 * Optional `space_id` field for flat-MVP spaces — GAC-007 deferred-flat
 * resolution. Every node that can be scoped to a space adds this via
 * `.extend({ space_id: spaceIdField })`. Nesting semantics are explicitly v2.
 */
export const spaceIdField = idSchema.optional();
