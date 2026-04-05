# Babysitter Channels

This document is the operator-facing contract for EMA's babysitter stream and Discord delivery path.

## Canonical Topology

Code source of truth:

- `daemon/lib/ema/babysitter/channel_topology.ex`

The `STREAM OF CONSCIOUSNESS` Discord category currently contains these logical babysitter streams:

| Stream | Discord channel | Channel ID | Driver | Status | Purpose |
| --- | --- | --- | --- | --- | --- |
| `live` | `babysitter-live` | `1489786483970936933` | `Ema.Babysitter.StreamTicker` | active | Primary operator summary stream |
| `heartbeat` | `system-heartbeat` | `1489820670333423827` | `Ema.Babysitter.StreamChannels` | active | VM, DB, queue, and latency health |
| `intent` | `intent-stream` | `1489820673760301156` | `Ema.Babysitter.StreamChannels` | active | Intent and routing activity |
| `pipeline` | `pipeline-flow` | `1489820676859756606` | `Ema.Babysitter.StreamChannels` | active | Proposal, pipeline, and execution flow |
| `agent` | `agent-thoughts` | `1489820679472677044` | `Ema.Babysitter.StreamChannels` | active | Claude session activity |
| `intelligence` | `intelligence-layer` | `1489820682198974525` | `Ema.Babysitter.StreamChannels` | active | Router, bandit, and scope-advisor signals |
| `memory` | `memory-writes` | `1489820685101699193` | `Ema.Babysitter.StreamChannels` | active | Second Brain and memory writes |
| `execution` | `execution-log` | `1489820687563493408` | `Ema.Babysitter.StreamChannels` | active | Active and recent execution work |
| `evolution` | `evolution-signals` | `1489820691074387979` | `Ema.Babysitter.StreamChannels` | active | Evolution/self-improvement signals |
| `speculative` | `speculative-feed` | `1489820693758607370` | `Ema.Babysitter.StreamChannels` | dormant | Kept registered, not auto-scheduled |

## Channel States

Active channels:

- These are scheduled automatically.
- `live` uses `Ema.Babysitter.StreamTicker`.
- All other active babysitter streams use `Ema.Babysitter.StreamChannels`.
- Cadence is controlled by `Ema.Babysitter.TickPolicy`, not by hardcoded per-file interval tables.
- Delivery is state-change-driven: unchanged steady-state summaries are skipped, repeated degraded heartbeat summaries are suppressed, and skip reasons are logged in the babysitter drivers.

Dormant channels:

- These stay registered in `Ema.Feedback.DiscordDelivery` so operators or other producers can still send to them.
- Dormant does not mean deleted or invalid. It means EMA is not currently auto-scheduling posts into that channel.
- `speculative-feed` is intentionally dormant today.

Control channels:

- `babysitter:control` is an internal PubSub topic, not a Discord channel.
- `Ema.Babysitter.VisibilityHub` records it as control activity.
- Tick policy may use control activity as a signal when deciding cadence.

Delivery-only channels:

- Channels such as `critical-blockers-track`, `core-loop-implementation`, `alerts`, and `ops-log` are registered for outbound delivery but are not part of the babysitter stream scheduler.
- They remain valid Discord targets for nudges, alerts, and other publishers.

## Real Outbound Delivery Path

Babysitter and related outbound messages follow this path:

1. A producer publishes to `discord:outbound:<channel_id>`.
   Producers in this repo include:
   - `Ema.Babysitter.StreamTicker`
   - `Ema.Babysitter.StreamChannels`
   - `Ema.Babysitter.OrgController`
2. `Ema.Feedback.DiscordDelivery.Worker` subscribes per channel.
3. The worker calls `Ema.Feedback.Broadcast.emit/4`.
4. `Ema.Feedback.Broadcast` always mirrors the message to `ema:feedback`.
5. If `DISCORD_BOT_TOKEN` is set, `Ema.Feedback.Broadcast` posts directly to Discord REST.
6. `Ema.Feedback.Consumer` subscribes to `ema:feedback`, stores the event, and rebroadcasts to `ema:hq:feedback` for EMA-side visibility.

This means:

- Discord publishing is already implemented in-repo.
- Babysitter outbound publishing does not go through `Ema.Discord.Bridge`.
- `Ema.Discord.Bridge` is the inbound conversational/session path, not the babysitter outbound stream path.

## Operator Notes

- `/api/babysitter/state` now exposes active and dormant topology plus stream runtime state.
- `/api/feedback/status` shows live Discord delivery worker registration.
- The legacy `babysitter.tick_interval_ms` setting is still honored for the main `live` stream, but the canonical cadence model is `Ema.Babysitter.TickPolicy`.
