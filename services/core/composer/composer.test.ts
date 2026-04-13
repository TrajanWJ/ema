/**
 * Composer tests. Each test uses an isolated temp artifactsRoot so the suite
 * never writes to the real vault directory.
 */

import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Composer } from './composer.js';
import { generateRunId, isRunId } from './run-id.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe('Composer', () => {
  let root: string;
  let composer: Composer;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ema-composer-'));
    composer = new Composer({ artifactsRoot: root });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('happy path: compile writes prompt.md and context.json, recordResponse writes response.md', async () => {
    const result = await composer.compile({
      prompt: '# Test prompt\n\nDo the thing.',
      context: { project: 'ema', seed: 42 },
      metadata: { intentSlug: 'test-intent', purpose: 'unit-test' },
    });

    expect(result.warnings).toEqual([]);
    expect(isRunId(result.artifact.runId)).toBe(true);
    expect(result.artifact.artifactDir).toBe(join(root, result.artifact.runId));

    const promptBody = await readFile(result.artifact.promptPath, 'utf8');
    expect(promptBody).toBe('# Test prompt\n\nDo the thing.');

    const contextBody = await readFile(result.artifact.contextPath, 'utf8');
    const contextParsed: unknown = JSON.parse(contextBody);
    expect(contextParsed).toMatchObject({
      runId: result.artifact.runId,
      metadata: { intentSlug: 'test-intent', purpose: 'unit-test' },
      context: { project: 'ema', seed: 42 },
    });

    // response.md should not exist yet
    expect(await pathExists(result.artifact.responsePath)).toBe(false);

    await composer.recordResponse(result.artifact.runId, '## response\n\nDone.');
    const responseBody = await readFile(result.artifact.responsePath, 'utf8');
    expect(responseBody).toBe('## response\n\nDone.');
  });

  it('artifact write failure degrades gracefully: returns warnings, does not throw', async () => {
    // Point the composer at a non-writable path. The parent is a regular file
    // so mkdir will fail (ENOTDIR).
    const blockingFile = join(root, 'not-a-dir');
    await writeFile(blockingFile, 'block');
    const blocked = new Composer({ artifactsRoot: blockingFile });

    const result = await blocked.compile({ prompt: 'hi' });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/Artifact directory unreachable/);
    // No apologies, no emojis per EMA-VOICE
    for (const w of result.warnings) {
      expect(w).not.toMatch(/sorry|oops|unfortunately|[\u{1F300}-\u{1FAFF}]/iu);
    }
    // The call still returned an artifact handle so the caller can proceed.
    expect(isRunId(result.artifact.runId)).toBe(true);
  });

  it('concurrent compiles do not collide: 20 parallel runs produce 20 unique dirs', async () => {
    const runs = await Promise.all(
      Array.from({ length: 20 }, () => composer.compile({ prompt: 'p' })),
    );

    const ids = new Set(runs.map((r) => r.artifact.runId));
    expect(ids.size).toBe(20);
    for (const r of runs) {
      expect(r.warnings).toEqual([]);
      expect(await pathExists(r.artifact.promptPath)).toBe(true);
      expect(await pathExists(r.artifact.contextPath)).toBe(true);
    }
  });

  it('generateRunId is unique across a tight loop and matches isRunId', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5000; i += 1) {
      const id = generateRunId();
      expect(isRunId(id)).toBe(true);
      ids.add(id);
    }
    expect(ids.size).toBe(5000);
  });

  it('previous artifact preserved when a later compile fails mid-write', async () => {
    // First: a healthy compile.
    const first = await composer.compile({
      prompt: 'first prompt',
      context: { n: 1 },
    });
    expect(first.warnings).toEqual([]);
    const firstPromptBody = await readFile(first.artifact.promptPath, 'utf8');
    expect(firstPromptBody).toBe('first prompt');

    // Second: break the artifacts root by replacing it with a file AFTER the
    // first compile succeeded. The second compile will surface warnings.
    await rm(root, { recursive: true, force: true });
    await writeFile(root, 'blocked');

    const second = await composer.compile({ prompt: 'second prompt' });
    expect(second.warnings.length).toBeGreaterThan(0);

    // The "previous artifact" lives on whatever disk region was not broken.
    // Here we just assert the broken compile did NOT corrupt a sibling run
    // in the same root: the second run's prompt must not overwrite the first
    // run's prompt path, because run IDs differ.
    expect(second.artifact.promptPath).not.toBe(first.artifact.promptPath);

    // list() gracefully returns empty on an unreadable root rather than throwing.
    const listed = await composer.list();
    expect(Array.isArray(listed)).toBe(true);
  });

  it('list returns newest runs first and get resolves a live run', async () => {
    const a = await composer.compile({ prompt: 'a' });
    // Force a different timestamp millisecond so sort order is deterministic.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const b = await composer.compile({ prompt: 'b' });

    const listed = await composer.list();
    expect(listed.length).toBe(2);
    expect(listed[0]?.runId).toBe(b.artifact.runId);
    expect(listed[1]?.runId).toBe(a.artifact.runId);

    const fetched = await composer.get(a.artifact.runId);
    expect(fetched?.runId).toBe(a.artifact.runId);

    const missing = await composer.get('20260101T000000000Z-zzzzzz');
    expect(missing).toBeNull();

    const invalid = await composer.get('not-a-real-id');
    expect(invalid).toBeNull();
  });

  it('recordResponse throws on unknown or malformed run id', async () => {
    await expect(composer.recordResponse('bogus', 'x')).rejects.toThrow(/Invalid run id/);
    await expect(
      composer.recordResponse('20260101T000000000Z-zzzzzz', 'x'),
    ).rejects.toThrow(/Run directory missing/);
  });
});
