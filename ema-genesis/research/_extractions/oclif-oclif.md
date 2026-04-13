---
id: EXTRACT-oclif-oclif
type: extraction
layer: research
category: cli-terminal
title: "Source Extractions — oclif/oclif (+ oclif/core runtime)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: agent-A7
clone_path: "../_clones/oclif-oclif/ and ../_clones/oclif-core/"
source:
  url: https://github.com/oclif/oclif
  sha: f82231e
  clone_date: 2026-04-12
  depth: shallow-1
  size_mb: 2.1
secondary:
  url: https://github.com/oclif/core
  sha: main (shallow)
  size_mb: 3.0
tags: [extraction, cli-terminal, oclif, PRIMARY-PORT-TARGET]
connections:
  - { target: "[[research/cli-terminal/oclif-oclif]]", relation: source_of }
  - { target: "[[research/_clones/INDEX]]", relation: references }
---

# Source Extractions — oclif/oclif + @oclif/core

> Companion extraction for `[[research/cli-terminal/oclif-oclif]]`. **This is EMA's PRIMARY PORT TARGET** for the TypeScript CLI framework (`ema <noun> <verb>` pattern). The `oclif/oclif` repo is the **generator/manager CLI**; the actual runtime lives in `@oclif/core` which was cloned as a secondary reference. All runtime patterns below refer to `oclif-core/src/*`.

## Clone metadata

| Field | Value |
|---|---|
| URL (primary) | https://github.com/oclif/oclif |
| URL (runtime) | https://github.com/oclif/core |
| Clone depth | --depth=1 shallow |
| Clone date | 2026-04-12 |
| Clone size | ~2.1 MB (oclif) + ~3.0 MB (core) |
| Language | TypeScript |
| License | MIT |
| Key commit SHA | `f82231e` (oclif CLI tool, v4.23.0) |

## Install attempt

- **Attempted:** no — user scope says `npm install -g oclif` is OK but not required for extraction
- **Command:** N/A
- **Result:** skipped
- **If skipped, why:** The read-only source files were sufficient for extraction. Installing the generator would be useful only to see templated output, which is already visible under `oclif-oclif/templates/`.

## Run attempt

- **Attempted:** no
- **Command:** N/A
- **Result:** skipped
- **If skipped, why:** see above

## Key files identified (ordered by porting priority)

1. `oclif-core/src/command.ts` — **the `Command` abstract base class**. The entire oclif runtime is a class inheritance model on top of this file. Every subcommand is a `class extends Command { run() { ... } }`. (444 lines)
2. `oclif-core/src/config/plugin.ts` — **the plugin loader**. Resolves filesystem conventions (`commandDiscovery.strategy: 'pattern' | 'single' | 'explicit'`), runs glob against the commands dir, reads `oclif.manifest.json` cache, builds `Command.Loadable[]`. (414 lines)
3. `oclif-core/src/config/plugin.ts:51-63` — **topic-based directory convention**. `processCommandIds` converts `tasks/list.ts` filesystem path to `tasks:list` command ID via `dir.split('/')` + filename (excluding `index`).
4. `oclif-core/src/main.ts` — **`run(argv, options)` entry point**. What every CLI bin script calls. 111 lines.
5. `oclif-core/src/flags.ts` — **flag definition primitives** (`boolean`, `integer`, `string`, `url`, `file`, `directory`, `option`, `custom`). 243 lines.
6. `oclif-core/src/util/aggregate-flags.ts` — **the `--json` global flag injection**. When a command sets `static enableJsonFlag = true`, this helper auto-merges a `--json` boolean flag into the command's flag set under the `'GLOBAL'` help group.
7. `oclif-core/src/command.ts:236-250` — `jsonEnabled()`: detects `--json` in argv OR env var `CONTENT_TYPE=json`, handles `--` passthrough.
8. `oclif-core/src/command.ts:166-190` — `_run()` internal lifecycle: `init → run → catch → finally → logJson(toSuccessJson(result))` when json-enabled.
9. `oclif-core/src/config/config.ts` — plugin discovery, command registry (Permutations map for flexible taxonomy), `findCommand`/`runCommand`. 886 lines.
10. `oclif-oclif/src/commands/generate.ts` + `templates/` — scaffolding of new CLI projects. Not critical for runtime, skip for port.

## Extracted patterns

### Pattern 1: `Command` abstract base class — the user-facing API

**Files:**
- `oclif-core/src/command.ts:49-300` — class definition with static fields + `_run` lifecycle
- `oclif-core/src/command.ts:166-190` — `_run` internal runner

**Snippet (verbatim):**
```typescript
// oclif-core/src/command.ts:49-160
export abstract class Command {
  private static readonly _base = `${pjson.name}@${pjson.version}`
  /** An array of aliases for this command. */
  public static aliases: string[] = []
  /** An order-dependent object of arguments for the command */
  public static args: ArgInput = {}
  public static baseFlags: FlagInput
  /**
   * Emit deprecation warning when a command alias is used
   */
  static deprecateAliases?: boolean
  public static deprecationOptions?: Deprecation
  public static description: string | undefined
  public static enableJsonFlag = false
  public static examples: Command.Example[]
  /** A hash of flags for the command */
  public static flags: FlagInput
  public static hasDynamicHelp = false
  public static help: string | undefined
  /** Hide the command from help */
  public static hidden: boolean
  /** An array of aliases for this command that are hidden from help. */
  public static hiddenAliases: string[] = []
  /** A command ID, used mostly in error or verbose reporting. */
  public static id: string
  public static plugin: Plugin | undefined
  public static readonly pluginAlias?: string
  public static readonly pluginName?: string
  public static readonly pluginType?: string
  public static state?: 'beta' | 'deprecated' | string
  /** When set to false, allows a variable amount of arguments */
  public static strict = true
  public static summary?: string
  public static usage: string | string[] | undefined
  protected debug: (...args: any[]) => void
  public id: string | undefined
  public parsed = false

  public constructor(
    public argv: string[],
    public config: Config,
  ) {
    this.id = this.ctor.id
    try {
      this.debug = makeDebug(this.id ? `${this.config.bin}:${this.id}` : this.config.bin)
    } catch {
      this.debug = () => {}
    }
  }

  public static async run<T extends Command>(
    this: new (argv: string[], config: Config) => T,
    argv?: string[],
    opts?: LoadOptions,
  ): Promise<ReturnType<T['run']>> {
    if (!argv) argv = process.argv.slice(2)
    if (typeof opts === 'string' && opts.startsWith('file://')) {
      opts = fileURLToPath(opts)
    }
    const config = await Config.load(opts || require.main?.filename || __dirname)
    const cache = Cache.getInstance()
    if (!cache.has('config')) cache.set('config', config)
    const cmd = new this(argv, config)
    if (!cmd.id) {
      const id = cmd.constructor.name.toLowerCase()
      cmd.id = id
      cmd.ctor.id = id
    }
    return cmd._run<ReturnType<T['run']>>()
  }
```

```typescript
// oclif-core/src/command.ts:166-205 — the lifecycle
protected async _run<T>(): Promise<T> {
  let err: Error | undefined
  let result: T | undefined
  try {
    this.removeEnvVar('REDIRECTED')
    await this.init()
    result = await this.run()
  } catch (error: any) {
    err = error
    await this.catch(error)
  } finally {
    await this.finally(err)
  }

  if (result && this.jsonEnabled()) this.logJson(this.toSuccessJson(result))

  if (!this.parsed && !isProd()) {
    process.emitWarning(`Command ${this.id} did not parse its arguments. Did you forget to call 'this.parse'?`, {
      code: 'UnparsedCommand',
    })
  }
  return result as T
}

protected async catch(err: CommandError): Promise<any> {
  process.exitCode = process.exitCode ?? err.exitCode ?? 1
  if (this.jsonEnabled()) {
    this.logJson(this.toErrorJson(err))
  } else {
    if (!err.message) throw err
    throw err
  }
}

public abstract run(): Promise<any>
```

**What to port to EMA:**
Port verbatim as `new-build/core/cli/Command.ts`. Rename `Config` to `EmaConfig` (or whatever the shell context is called). Keep the abstract class pattern — `run()` is abstract, users extend. Keep `static flags`, `static args`, `static examples`, `static enableJsonFlag`, `static description`. Drop oclif-specific `pjson`/`Cache` references; EMA has its own context object.

**Adaptation notes:**
- The `debug` library import can stay or be replaced with EMA's own logger.
- `Cache.getInstance()` is a module-global singleton — replace with EMA's DI/context.
- `removeEnvVar('REDIRECTED')` is for oclif's auto-update subprocess pattern — skip unless EMA does auto-update.
- Keep the `_run` try/catch/finally shape — this is the pattern that makes json mode + error handling work cleanly.

### Pattern 2: Topic-based command directory convention (`commandDiscovery.strategy: 'pattern'`)

**Files:**
- `oclif-core/src/config/plugin.ts:51-64` — glob patterns + `processCommandIds`
- `oclif-core/src/config/plugin.ts:335-373` — `getCommandIDs` + `getCommandIdsFromPattern`

**Snippet (verbatim):**
```typescript
// oclif-core/src/config/plugin.ts:51-64
const GLOB_PATTERNS = [
  '**/*.+(js|cjs|mjs|ts|tsx|mts|cts)',
  '!**/*.+(d.ts|test.ts|test.js|spec.ts|spec.js|d.mts|d.cts)?(x)',
]

function processCommandIds(files: string[]): string[] {
  return files.map((file) => {
    const p = parse(file)
    const topics = p.dir.split('/')
    const command = p.name !== 'index' && p.name
    const id = [...topics, command].filter(Boolean).join(':')
    return id === '' ? SINGLE_COMMAND_CLI_SYMBOL : id
  })
}
```

```typescript
// oclif-core/src/config/plugin.ts:366-373
private async getCommandIdsFromPattern(): Promise<string[]> {
  const commandsDir = await this.getCommandsDir()
  if (!commandsDir) return []

  this._debug(`loading IDs from ${commandsDir}`)
  const files = await glob(this.commandDiscoveryOpts?.globPatterns ?? GLOB_PATTERNS, {cwd: commandsDir})
  return processCommandIds(files)
}
```

**What to port to EMA:**
**This is the directory-convention engine for `ema <noun> <verb>`**. For EMA:
- Commands live in `new-build/cli/commands/<noun>/<verb>.ts`
- `parse(file).dir.split('/')` yields `['tasks']`, filename `list`, joined as `tasks:list`
- EMA should use a space separator instead of `:` — the `Config` class already supports this via `topicSeparator: ' ' | ':'` (see `oclif-core/src/config/config.ts:105`).

**Adaptation notes:**
- Use `fast-glob` or `tinyglobby` (oclif uses `tinyglobby`).
- For EMA's `<noun> <verb>` preference, set `topicSeparator: ' '` in the EMA config — oclif supports this already, no porting needed.
- The `index` filename maps to a bare topic — good for `ema tasks` listing subcommands.
- `SINGLE_COMMAND_CLI_SYMBOL` is for CLIs that are just one command (no subcommands) — not relevant for EMA.

### Pattern 3: Plugin manifest caching — `oclif.manifest.json`

**Files:**
- `oclif-core/src/config/plugin.ts:186-238` — `load()` method wires manifest
- `oclif-core/src/config/plugin.ts:240-318` — `_manifest()` reads cached JSON or builds from source
- `oclif-core/src/config/plugin.ts:245-265` — `readManifest` with `.oclif.manifest.json` fallback

**Snippet (verbatim):**
```typescript
// oclif-core/src/config/plugin.ts:245-275
const readManifest = async (dotfile = false): Promise<Manifest | undefined> => {
  try {
    const p = join(this.root, `${dotfile ? '.' : ''}oclif.manifest.json`)
    const manifest = await readJson<Manifest>(p)
    if (!process.env.OCLIF_NEXT_VERSION && manifest.version.split('-')[0] !== this.version.split('-')[0]) {
      process.emitWarning(
        `Mismatched version in ${this.name} plugin manifest. ...`,
      )
    } else {
      this._debug('using manifest from', p)
      this.hasManifest = true
      return manifest
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      if (!dotfile) return readManifest(true)
    } else {
      this.warn(error, 'readManifest')
    }
  }
}
```

**What to port to EMA:**
Cache built command metadata at `ema.manifest.json` in the plugin/vApp root. At startup EMA reads cached manifests instead of walking every plugin's filesystem. Use this pattern for every vApp that ships CLI commands.

**Adaptation notes:**
- The manifest stores `Command.Cached` objects (see `command.ts:396-421`) — serializable subset of the command class: id, description, flags/args metadata, aliases, state. No runtime code.
- On first load without a cached manifest, oclif builds one from source. EMA can follow the same pattern: lazy cache regen.

### Pattern 4: `--json` flag infrastructure

**Files:**
- `oclif-core/src/util/aggregate-flags.ts:1-17` — the `json` boolean flag definition + merger
- `oclif-core/src/command.ts:236-250` — `jsonEnabled()` detection
- `oclif-core/src/command.ts:181` — lifecycle hook: `if (result && this.jsonEnabled()) this.logJson(this.toSuccessJson(result))`
- `oclif-core/src/command.ts:302-308` — `toSuccessJson`/`toErrorJson` (overridable hooks)
- `oclif-core/src/command.ts:252-268` — `log()` and `logToStderr()` suppression when json mode is active

**Snippet (verbatim):**
```typescript
// oclif-core/src/util/aggregate-flags.ts:1-17
import {boolean} from '../flags'
import {FlagInput, FlagOutput} from '../interfaces/parser'

const json = boolean({
  description: 'Format output as json.',
  helpGroup: 'GLOBAL',
})

export function aggregateFlags<F extends FlagOutput, B extends FlagOutput>(
  flags: FlagInput<F> | undefined,
  baseFlags: FlagInput<B> | undefined,
  enableJsonFlag: boolean | undefined,
): FlagInput<F> {
  const combinedFlags = {...baseFlags, ...flags}
  return (enableJsonFlag ? {json, ...combinedFlags} : combinedFlags) as FlagInput<F>
}
```

```typescript
// oclif-core/src/command.ts:236-261 — jsonEnabled + log suppression
public jsonEnabled(): boolean {
  // If the command doesn't support json, return false
  if (!this.ctor?.enableJsonFlag) return false

  // If the CONTENT_TYPE env var is set to json, return true
  if (this.config.scopedEnvVar?.('CONTENT_TYPE')?.toLowerCase() === 'json') return true

  const passThroughIndex = this.argv.indexOf('--')
  const jsonIndex = this.argv.indexOf('--json')
  return passThroughIndex === -1
    ? jsonIndex !== -1
    : jsonIndex !== -1 && jsonIndex < passThroughIndex
}

public log(message = '', ...args: any[]): void {
  if (!this.jsonEnabled()) {
    message = typeof message === 'string' ? message : inspect(message)
    ux.stdout(message, ...args)
  }
}

protected logJson(json: unknown): void {
  ux.stdout(ux.colorizeJson(json, {pretty: true, theme: this.config.theme?.json}))
}
```

**What to port to EMA:**
- Copy `aggregateFlags` verbatim into `new-build/core/cli/flags.ts`.
- Every EMA command must set `static enableJsonFlag = true` by default (unlike oclif where default is `false`). Reason: EMA is programmable-first, human-readable is the special case.
- Enforce log suppression rule: when `jsonEnabled()` is true, any `this.log()` output is silenced — the only output is the single `logJson(toSuccessJson(result))` call at the end of `_run`.
- `toSuccessJson(result)` is an overridable hook per command — lets EMA commands shape their json output without touching the lifecycle.

**Adaptation notes:**
- oclif uses `CONTENT_TYPE=json` env var as a second trigger — adopt this or rename to `EMA_OUTPUT=json`.
- The `--` passthrough rule is subtle but important: `ema foo -- --json` should NOT enter json mode (the `--json` is an arg to the subcommand, not to oclif).

### Pattern 5: `Config.load` — the runtime root

**Files:**
- `oclif-core/src/main.ts:31-111` — the public `run(argv, options)` entry point
- `oclif-core/src/config/config.ts:124-143` — `Config.load` static factory

**Snippet (verbatim):**
```typescript
// oclif-core/src/main.ts:31-111
export async function run(argv?: string[], options?: Interfaces.LoadOptions): Promise<unknown> {
  const marker = Performance.mark(OCLIF_MARKER_OWNER, 'main.run')
  const initMarker = Performance.mark(OCLIF_MARKER_OWNER, 'main.run#init')

  const showHelp = async (argv: string[]) => {
    const Help = await loadHelpClass(config)
    const help = new Help(config, config.pjson.oclif.helpOptions ?? config.pjson.helpOptions)
    await help.showHelp(argv)
  }

  setLogger(options)

  const {debug} = getLogger('main')
  argv = argv ?? process.argv.slice(2)
  if (options && ((typeof options === 'string' && options.startsWith('file://')) || options instanceof URL)) {
    options = fileURLToPath(options)
  }

  const config = await Config.load(options ?? require.main?.filename ?? __dirname)
  Cache.getInstance().set('config', config)
  if (config.isSingleCommandCLI) {
    argv = [SINGLE_COMMAND_CLI_SYMBOL, ...argv]
  }

  const [id, ...argvSlice] = normalizeArgv(config, argv)

  const runFinally = async (cmd?: Command.Loadable, error?: Error) => {
    marker?.stop()
    if (!initMarker?.stopped) initMarker?.stop()
    await Performance.collect()
    Performance.debug()
    await config.runHook('finally', {argv: argvSlice, Command: cmd, error, id})
  }

  await config.runHook('init', {argv: argvSlice, id})

  if (versionAddition(argv, config)) {
    ux.stdout(config.userAgent)
    await runFinally()
    return
  }

  if (helpAddition(argv, config)) {
    await showHelp(argv)
    await runFinally()
    return
  }

  const cmd = config.findCommand(id)
  if (!cmd) {
    const topic = config.flexibleTaxonomy ? null : config.findTopic(id)
    if (topic) {
      await showHelp([id])
      await runFinally()
      return
    }
  }

  initMarker?.stop()

  let err: Error | undefined
  try {
    return await config.runCommand(id, argvSlice, cmd)
  } catch (error) {
    err = error as Error
    throw error
  } finally {
    await runFinally(cmd, err)
  }
}
```

**What to port to EMA:**
This becomes `new-build/core/cli/index.ts`. The EMA CLI entry bin script imports `run` and invokes it:
```ts
#!/usr/bin/env node
import {run} from '@ema/cli'
run(process.argv.slice(2), {root: __dirname}).catch(console.error)
```

**Adaptation notes:**
- Hooks: `init`, `finally`, `prerun`, `postrun`, `command_not_found`, `command_incomplete`, `preparse`, `jit_plugin_not_installed`. EMA should adopt `init` + `finally` at minimum. `preparse` lets a plugin rewrite `argv` before parsing — useful for EMA's "noun verb" → "noun:verb" normalization.
- Performance markers: oclif uses `process.hrtime.bigint()` wrappers. Drop for MVP.
- `flexibleTaxonomy` allows `ema foo:bar:baz` to match `ema bar:foo:baz` — skip for MVP.

### Pattern 6: Flag primitives

**Files:**
- `oclif-core/src/flags.ts:26-71` — `custom` factory (all other flag types wrap this)
- `oclif-core/src/flags.ts:73-85` — `boolean`
- `oclif-core/src/flags.ts:93-103` — `integer` with min/max validation
- `oclif-core/src/flags.ts:110-129` — `directory`, `file` (with `exists` check)
- `oclif-core/src/flags.ts:136-144` — `url` (auto URL parse + validation)
- `oclif-core/src/flags.ts:154-162` — `version` boolean flag
- `oclif-core/src/flags.ts:167-178` — `help` boolean flag
- `oclif-core/src/flags.ts:195-243` — `option` (enum/choice) with type inference from `as const` arrays

**Snippet (verbatim):**
```typescript
// oclif-core/src/flags.ts:60-103
export function custom<T = string, P extends CustomOptions = CustomOptions>(
  defaults?: Partial<OptionFlag<T, P>>,
): FlagDefinition<T, P, {multiple: boolean; requiredOrDefaulted: boolean}> {
  return (options: any = {}) => ({
    parse: async (input, _ctx, _opts) => input,
    ...defaults,
    ...options,
    input: [] as string[],
    multiple: Boolean(options.multiple === undefined ? (defaults?.multiple ?? false) : options.multiple),
    type: 'option',
  })
}

export function boolean<T = boolean>(options: Partial<BooleanFlag<T>> = {}): BooleanFlag<T> {
  return {
    parse: async (b, _) => b,
    ...options,
    allowNo: Boolean(options.allowNo),
    type: 'boolean',
  } as BooleanFlag<T>
}

export const integer = custom<number, {max?: number; min?: number}>({
  async parse(input, _, opts) {
    if (!/^-?\d+$/.test(input)) throw new CLIError(`Expected an integer but received: ${input}`)
    const num = Number.parseInt(input, 10)
    if (opts.min !== undefined && num < opts.min)
      throw new CLIError(`Expected an integer greater than or equal to ${opts.min} but received: ${input}`)
    if (opts.max !== undefined && num > opts.max)
      throw new CLIError(`Expected an integer less than or equal to ${opts.max} but received: ${input}`)
    return num
  },
})
```

**What to port to EMA:**
Copy the entire `flags.ts` file. The `custom` factory + narrowly-typed `parse` callbacks give EMA the exact type-inference behavior (`Flags.integer({min: 0})` returns `number` at compile time).

**Adaptation notes:**
- The `custom<T, P>()` overload surface is elaborate — preserves type inference for `required`/`multiple`/`default`. Keep the overloads; removing them breaks type inference at the call site.
- For EMA's domain types (e.g., `Flags.task`, `Flags.project`, `Flags.intent`), write them as `Flags.custom<TaskId>({ parse: async (input) => validateTaskId(input) })`.

## Sample command — what a real command class looks like

**From `oclif-oclif/src/commands/lock.ts`** (small example):
```typescript
// Example shape (paraphrased from oclif-oclif/src/commands/lock.ts)
export default class Lock extends Command {
  static description = 'Prevent an oclif CLI from updating automatically'
  static examples = ['$ oclif lock']
  static flags = {
    help: Flags.help(),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Lock)
    // ... implementation
  }
}
```

## Gotchas found while reading

- **`static enableJsonFlag = false` by default.** In oclif, json mode is opt-in per command. In EMA, decide policy up front — I recommend default `true` and commands that can't output structured data opt out.
- **`this.parse()` vs `parse(Constructor)`** — you MUST pass the constructor class to `this.parse(MyCommand)` because `this.ctor` reference is type-erased at instance level. Inside `run()`, always call `await this.parse(MyCommand)` not `await this.parse()`.
- **`this.argv` can be rewritten by the `preparse` hook.** If EMA does "noun verb" normalization via preparse, downstream parsers see the rewritten version. Error messages need to track the original.
- **`removeEnvVar('REDIRECTED')`** (command.ts:171) is for oclif auto-update: when a CLI updates itself, the old binary re-execs the new one with a `REDIRECTED` env var so the new process knows not to update again. Skip for EMA unless doing auto-update.
- **`flexibleTaxonomy`** (plugin.ts:204, 292-295) builds a Cartesian product of topic orderings (`{a,b,c}:{a,b,c}:{a,b,c}` as permutations). For an EMA with many commands this is O(topics!) — only enable for CLIs with shallow topics.
- **Single-command symbol** (`SINGLE_COMMAND_CLI_SYMBOL`) is a Symbol used when the CLI has no subcommands, just `ema`. Don't use for EMA.
- **Plugin manifest version mismatch warning** (plugin.ts:249-253) fires when `oclif.manifest.json` has a different version than package.json. In EMA this usually indicates stale cache from a dev build — strip the warning or make it a debug log.
- **ESM vs CJS detection** — `plugin.ts:205` sets `moduleType` from `pjson.type === 'module'`. The `module-loader.ts` uses dynamic `import()` vs `require()` accordingly. EMA will be pure ESM so simplify to always `import`.
- **Node PATH coercion** — `cachedCommandCanBeUsed` + `loadWithDataFromManifest` at plugin.ts:150 lets manifested commands load without touching the filesystem. Preserve this — it's what makes startup O(1) regardless of command count.

## Port recommendation

**Order of work:**

1. **`new-build/core/cli/Command.ts`** ← port `oclif-core/src/command.ts:49-369` verbatim. Rename `Config` → `EmaContext`. Delete `Cache.getInstance()` references. Delete `removeEnvVar('REDIRECTED')`. Change `static enableJsonFlag = true` (default-on for EMA).
2. **`new-build/core/cli/flags.ts`** ← port `oclif-core/src/flags.ts:1-243` verbatim. Keep all overloads.
3. **`new-build/core/cli/parser.ts`** ← port `oclif-core/src/parser/` (not read in this extraction, but shallow: arg parsing, flag parsing, error messages). Review before porting.
4. **`new-build/core/cli/PluginLoader.ts`** ← simplified port of `oclif-core/src/config/plugin.ts:1-414`. Keep `pattern` strategy. Drop `single`/`explicit` (use only directory convention). Drop `flexibleTaxonomy`. Keep manifest caching.
5. **`new-build/core/cli/Config.ts`** ← port `oclif-core/src/config/config.ts:1-886` but aggressively trim. Keep: plugin registration, command registry, `findCommand`, `runCommand`, hook invocation. Drop: `binAliases`, `userAgent` string (keep simple), `updateConfig`, `s3 templates`, theme (until EMA has theming).
6. **`new-build/core/cli/index.ts`** ← port `oclif-core/src/main.ts:1-111`. This is the `run()` entry point.
7. **`new-build/core/cli/aggregate-flags.ts`** ← port `oclif-core/src/util/aggregate-flags.ts:1-17`. Change `enableJsonFlag ?` default to true.
8. **Unit test** against oclif's own test suite at `oclif-core/test/` (~60 test files; cover lifecycle, parsing, json mode, aliases, deprecation, manifest, hooks).

**Dependency decisions:**
- Keep: `tinyglobby` (for command discovery), `debug` (or replace with pino).
- Drop: `@oclif/core`'s `Performance` markers (hrtime.bigint), `chalk` dependencies in ux (use EMA's styled output), `widest-line`/`wordwrap` (help formatter — rewrite for EMA's narrower scope).
- Replace: `ejs` templates for help — EMA is glass-aesthetic, write bespoke help.

**Testing approach:**
- Vitest over AVA. Port oclif's test fixtures at `oclif-core/test/command/command.test.ts` → Vitest.
- E2E: a fixture CLI with 3 commands (`tasks list`, `tasks create`, `tasks delete`), verify `--json` output is valid JSON and matches schema.

**Risks:**
- **Type inference on flag overloads** — oclif has 4+ overloads for each flag type to get `required`/`default` correct in the result type. These are hard to port cleanly. Read `interfaces/parser.ts` and `interfaces/flags.ts` before committing to the approach.
- **Hook contract** — oclif hooks are `run via config.runHook(name, opts)` and accept a `this: Hook.Context` with `log`, `error`, `config`. Porting hooks is non-trivial; you need to decide EMA's plugin lifecycle first.
- **Sync vs async plugin loading** — oclif lazy-loads command modules (via `cmd.load()` thunks on `Command.Loadable`). This matters at scale. Don't eagerly require all plugins.

## Related extractions

- `[[research/_extractions/microsoft-node-pty]]` — pairs with oclif for EMA's terminal runtime
- `[[research/_extractions/alex8088-electron-vite]]` — build system for the CLI + Electron shell

## Connections

- `[[research/cli-terminal/oclif-oclif]]` — original research node
- `[[research/_clones/INDEX]]`

#extraction #cli-terminal #oclif #PRIMARY-PORT-TARGET
