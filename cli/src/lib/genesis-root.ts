// genesis-root.ts
//
// Locate the `ema-genesis/` folder. The CLI runs from anywhere inside the
// repo so we walk up from the current working directory until we find
// either a directory named `ema-genesis` or a parent directory that
// contains one. Stops at the filesystem root.
//
// Override with env var: `EMA_GENESIS_ROOT=/abs/path/to/ema-genesis`.
// That's the escape hatch for running the CLI against a genesis folder
// that's not an ancestor of $PWD (tests, sibling checkouts, etc.).

import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';

const GENESIS_DIR_NAME = 'ema-genesis';
const ENV_OVERRIDE = 'EMA_GENESIS_ROOT';

/**
 * Walk up from `startDir` looking for the ema-genesis folder.
 *
 * Resolution order:
 *   1. `process.env.EMA_GENESIS_ROOT` if set and valid.
 *   2. `startDir` itself if basename === 'ema-genesis'.
 *   3. `startDir/ema-genesis` if that directory exists.
 *   4. Walk up one level and repeat 2 & 3, until `/`.
 *
 * @returns Absolute path to the genesis folder.
 * @throws If none found. Error message includes the start dir.
 */
export function findGenesisRoot(startDir: string = process.cwd()): string {
  const override = process.env[ENV_OVERRIDE];
  if (override && override.length > 0) {
    const abs = resolve(override);
    if (isDir(abs)) {
      return abs;
    }
    throw new Error(
      `${ENV_OVERRIDE} points to "${abs}" but that's not a directory.`,
    );
  }

  let current = resolve(startDir);
  // Safety guard: dirname('/') === '/', so loop until parent === current.
  while (true) {
    // Case: we're standing inside ema-genesis/ already.
    if (basename(current) === GENESIS_DIR_NAME && isDir(current)) {
      return current;
    }
    // Case: we're in a parent, look for sibling ema-genesis/.
    const candidate = join(current, GENESIS_DIR_NAME);
    if (isDir(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(
    `Could not locate ${GENESIS_DIR_NAME}/ by walking up from ${startDir}. ` +
      `Set ${ENV_OVERRIDE} to override.`,
  );
}

/** Tiny helper — `fs.statSync` throws on missing, we want boolean. */
function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Resolve a path relative to the genesis root. Convenience for commands. */
export function genesisPath(...segments: string[]): string {
  return join(findGenesisRoot(), ...segments);
}

/** Directory containing research nodes. */
export function researchRoot(): string {
  return genesisPath('research');
}

/** Directory containing intent folders (each intent has its own subdir with README.md). */
export function intentsRoot(): string {
  return genesisPath('intents');
}

/** Directory containing canon specs. */
export function canonSpecsRoot(): string {
  return genesisPath('canon', 'specs');
}

/** Directory containing canon decisions (DEC-NNN files). */
export function canonDecisionsRoot(): string {
  return genesisPath('canon', 'decisions');
}

/** Directory containing execution records (each has its own subdir with README.md). */
export function executionsRoot(): string {
  return genesisPath('executions');
}

/** Directory containing meta / graph convention files. */
export function metaRoot(): string {
  return genesisPath('_meta');
}
