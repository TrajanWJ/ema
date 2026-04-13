#!/usr/bin/env node
// Production entry for the `ema` CLI. Hands off to oclif which discovers
// compiled commands under dist/commands and dispatches based on argv.
//
// Do NOT require ts-node here — this file runs the already-compiled code.
// For a TS-direct run, use bin/dev.js instead.

import { execute } from '@oclif/core';

await execute({ development: false, dir: import.meta.url });
