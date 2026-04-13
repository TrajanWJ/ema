# Cross-Pollination Source Registry

Updated: 2026-04-13
Status: initial registry

## Purpose

Track candidate source material for EMA bootstrap and cross-pollination.
Each source should eventually be typed by:
- category
- confidence
- freshness
- target EMA subsystem
- import posture

## Initial candidate groups

### Intent / context / orchestrator
- `/home/trajan/vault/wiki/Architecture/Intent-Execution-Wiring-Blueprint.md`
- `/home/trajan/vault/wiki/Intents/Features/Intent-Control-Plane.md`
- `/home/trajan/vault/wiki/Intents/Features/Intent-Wiki-Schematic.md`
- `/home/trajan/vault/wiki/system/Intent Backfill Infrastructure.md`
- `/home/trajan/vault/wiki/research/context-management-best-practices.md`
- `/home/trajan/vault/wiki/research/Agent Continuity Patterns.md`
- `/home/trajan/vault/wiki/research/Multi-Agent Coordination Patterns.md`

### Prompt / intent interface / metaprompting
- `/home/trajan/vault/wiki/agents/Host-Context/Prompt Library Sources.md`
- `/home/trajan/vault/wiki/reference/prompts/System Prompt Patterns.md`
- `/home/trajan/vault/wiki/reference/prompts/LangGPT System Prompts Collection.md`
- `/home/trajan/vault/wiki/reference/metaprompting/Advanced Prompt Engineering Frameworks.md`
- `/home/trajan/vault/wiki/reference/metaprompting/Metaprompting Patterns.md`
- `/home/trajan/vault/wiki/research/Prompt-Engineering-Findings.md`
- `/home/trajan/vault/wiki/research/Anti-Pattern Prompting.md`
- `/home/trajan/vault/wiki/system/EMA-Bootstrap-Metaprompting-Workflow.md`

### Memory / wiki / semantic systems
- `/home/trajan/vault/wiki/research/Three-Tier Memory Architecture.md`
- `/home/trajan/vault/wiki/research/Memory-Systems-Research.md`
- `/home/trajan/vault/wiki/research/Agent Memory Architectures.md`
- `/home/trajan/vault/wiki/research/Wiki-Graph-Memory-Systems.md`
- `/home/trajan/vault/wiki/research/EMA-Deep-Context-Synthesis-2026-04-03.md`

### OpenClaw / workspace / operator system bridges
- `/home/trajan/vault/wiki/projects/OpenClaw Agent Setup.md`
- `/home/trajan/vault/wiki/openclaw/OpenClaw Agent Workspace Guide.md`
- `/home/trajan/vault/wiki/openclaw/OpenClaw Agent Performance.md`
- `/home/trajan/vault/wiki/codebases/OpenClaw Agent System.md`

### Prompt archive pattern packs
- `/home/trajan/Documents/obsidian_first_stuff/twj1/Archive/Dead Weight/Prompts/Meta/Context Synthesis Prompt.md`
- `/home/trajan/Documents/obsidian_first_stuff/twj1/Archive/Dead Weight/Prompts/Meta/Agent Delegation Prompt.md`
- `/home/trajan/Documents/obsidian_first_stuff/twj1/Archive/Dead Weight/Prompts/Project/Task Breakdown Prompt.md`
- `/home/trajan/Documents/obsidian_first_stuff/twj1/Archive/Dead Weight/Prompts/Analysis/Architecture Evaluation Prompt.md`
- `/home/trajan/Documents/obsidian_first_stuff/twj1/Archive/Dead Weight/Prompts/Analysis/Security Review Prompt.md`

### External GitHub candidates — next IDE / blueprint / agent layer
- `https://github.com/ysz7/Arcforge` — graph-first backend IDE, plugin parser runtime, architecture JSON, prompt export, rollback-backed forge
- `https://github.com/CodeBoarding/CodeBoarding` — interactive architecture diagrams for codebases
- `https://github.com/qodo-ai/open-aware` — deep code research agent exposed through MCP
- `https://github.com/alvinveroy/CodeCompass` — codebase analysis and context tooling surface
- `https://github.com/adithya-s-k/GitVizz` — LLM-friendly repository summaries plus dependency graphs
- `https://github.com/sopaco/deepwiki-rs` — architecture-doc and code-wiki generation from repos
- `https://github.com/microsoft/typespec` — spec-first API/system design language
- `https://github.com/cline/cline` — IDE-embedded coding agent with explicit tool approval
- `https://github.com/OpenHands/OpenHands` — AI-driven development runtime for longer-horizon coding tasks
- `https://github.com/continuedev/continue` — open-source assistant / CI policy layer around AI coding

## Import posture vocabulary
- `durable-bootstrap` — should be distilled into EMA bootstrap corpus
- `pattern-reference` — useful pattern source, not canonical truth
- `anti-pattern` — preserve as warning / avoid list
- `historical-reference` — useful context, low direct implementation value
