/**
 * Composer public API.
 *
 * Usage:
 *   import { Composer } from '../core/composer/index.js';
 *   const composer = new Composer();
 *   const { artifact, warnings } = await composer.compile({ prompt, context });
 *   // ...invoke the LLM with `prompt` + `context`...
 *   await composer.recordResponse(artifact.runId, responseText);
 */

export { Composer } from './composer.js';
export type { ComposerOptions } from './composer.js';
export { generateRunId, isRunId } from './run-id.js';
export type {
  CompileInput,
  CompileMetadata,
  CompileResult,
  CompiledArtifact,
  ContextFile,
} from './types.js';
