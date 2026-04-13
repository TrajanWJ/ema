// Re-export surface for `@ema/cli`.
//
// Consumers almost always use the CLI via the `ema` bin. This module exists
// so that future tooling (editor extensions, MCP servers, test harnesses)
// can import library functions directly without spawning a subprocess.
//
// Everything exported here is considered stable within a minor version.

export { findGenesisRoot } from './lib/genesis-root.js';
export {
  loadAllResearchNodes,
  findResearchNodeBySlug,
  type ResearchNode,
  type ResearchNodeFrontmatter,
  type SignalTier,
} from './lib/node-loader.js';
export {
  parseFrontmatter,
  type ParsedMarkdown,
} from './lib/frontmatter.js';
export {
  scanClones,
  type CloneEntry,
} from './lib/clones-scanner.js';
export {
  scanExtractions,
  type ExtractionEntry,
} from './lib/extractions-scanner.js';
export {
  runRipgrep,
  type RipgrepHit,
} from './lib/rg-wrapper.js';
