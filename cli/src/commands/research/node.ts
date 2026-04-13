// research node — alias for `research get`.
//
// This exists because `ema research node <slug>` reads more naturally than
// `ema research get <slug>` in some contexts (especially when copying from
// wikilinks). Under the hood it's the same command — we simply re-export
// the `get` class so oclif registers it at a new path.

import ResearchGet from './get.js';

export default class ResearchNode extends ResearchGet {
  public static override readonly description: string =
    'Alias for `research get` — print a research node by slug.';
}
