#!/usr/bin/env node
// Dev entry. Uses oclif's development mode so it loads commands from
// source (via the tsx loader) instead of dist/. Run via `npm run dev`
// or directly with `tsx bin/dev.js`.
//
// Note: this file only works if tsx is installed. It's a convenience
// for the inner dev loop — the real entry is bin/run.js.

import { execute } from '@oclif/core';

await execute({ development: true, dir: import.meta.url });
