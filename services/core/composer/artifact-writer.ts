/**
 * Artifact writer — atomic per-run file writes for the Composer.
 *
 * Strategy: write to a sibling `<name>.tmp` file, then rename. If the final
 * rename never happens, the previous artifact (if any) is left untouched.
 *
 * Design notes:
 * - No external deps. Uses node:fs/promises only.
 * - Errors surface to the caller. Composer.compile() catches them and converts
 *   non-fatal failures into warnings per spec.
 * - Writes are UTF-8.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { ContextFile } from './types.js';

export const PROMPT_FILENAME = 'prompt.md';
export const CONTEXT_FILENAME = 'context.json';
export const RESPONSE_FILENAME = 'response.md';

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function atomicWrite(targetPath: string, body: string): Promise<void> {
  const tempPath = `${targetPath}.tmp`;
  await ensureDir(dirname(targetPath));
  await writeFile(tempPath, body, { encoding: 'utf8' });
  await rename(tempPath, targetPath);
}

export async function writePrompt(artifactDir: string, prompt: string): Promise<string> {
  const target = join(artifactDir, PROMPT_FILENAME);
  await atomicWrite(target, prompt);
  return target;
}

export async function writeContext(
  artifactDir: string,
  context: ContextFile,
): Promise<string> {
  const target = join(artifactDir, CONTEXT_FILENAME);
  await atomicWrite(target, `${JSON.stringify(context, null, 2)}\n`);
  return target;
}

export async function writeResponse(
  artifactDir: string,
  response: string,
): Promise<string> {
  const target = join(artifactDir, RESPONSE_FILENAME);
  await atomicWrite(target, response);
  return target;
}

export async function readContext(artifactDir: string): Promise<ContextFile | null> {
  try {
    const raw = await readFile(join(artifactDir, CONTEXT_FILENAME), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object') {
      return parsed as ContextFile;
    }
    return null;
  } catch {
    return null;
  }
}
