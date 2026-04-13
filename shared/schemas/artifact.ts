import { z } from "zod";

import { baseEntitySchema } from "./common.js";

export const artifactTypeSchema = z.enum([
  "summary",
  "report",
  "log",
  "patch",
  "file",
  "note",
]);

export const artifactSchema = baseEntitySchema.extend({
  execution_id: z.string().min(1),
  type: artifactTypeSchema,
  label: z.string().min(1),
  path: z.string().min(1).nullable(),
  mime_type: z.string().min(1).nullable(),
  content: z.string().min(1),
  created_by_actor_id: z.string().min(1),
  metadata: z.record(z.unknown()),
});

export type ArtifactType = z.infer<typeof artifactTypeSchema>;
export type Artifact = z.infer<typeof artifactSchema>;

function mintId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createArtifactFixture(
  overrides: Partial<Artifact> = {},
): Artifact {
  const now = nowIso();
  return artifactSchema.parse({
    id: overrides.id ?? mintId("artifact"),
    inserted_at: overrides.inserted_at ?? now,
    updated_at: overrides.updated_at ?? now,
    execution_id: overrides.execution_id ?? "execution_fixture",
    type: overrides.type ?? "summary",
    label: overrides.label ?? "Execution summary",
    path: overrides.path ?? null,
    mime_type: overrides.mime_type ?? "text/plain",
    content:
      overrides.content ??
      "Execution completed successfully and produced the expected system updates.",
    created_by_actor_id: overrides.created_by_actor_id ?? "actor_system",
    metadata: overrides.metadata ?? {},
  });
}

export const artifactExamples = [
  createArtifactFixture(),
  createArtifactFixture({
    type: "report",
    label: "Ground truth document",
    path: "docs/GROUND-TRUTH.md",
    content: "Evidence-backed audit of the EMA repository.",
  }),
];
