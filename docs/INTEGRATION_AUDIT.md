# Integration Audit — 2026-04-06

## 1. Discord Bridge (Ema.Discord.Bridge)

**Status: CONNECTED, DELIVERING**

The Discord Bridge is a GenServer that routes incoming Discord messages through VoiceCore/Jarvis. It is started via the voice flag and uses session-per-channel tracking.

**Inbound path:**
- `POST /api/discord/message` -> `DiscordWebhookController.receive/2` -> `Bridge.receive_message/3` -> `VoiceCore.send_text/2`
- Responses broadcast to PubSub topic `"discord:responses"`

**Outbound path (babysitter stream-of-consciousness):**
- `StreamChannels` ticks build messages and broadcast to `"discord:outbound:<channel_id>"` via PubSub
- `Feedback.DiscordDelivery.Worker` (one per channel) subscribes to those topics
- Workers call `Feedback.Broadcast.emit/4` which:
  1. Posts to Discord REST API (`https://discord.com/api/v10/channels/<id>/messages`) via `Req` HTTP library
  2. Publishes to `"ema:feedback"` PubSub for internal visibility

**Discord library:** No Nostrum/ex_gram. Uses raw HTTP via `Req` library.

**Credentials:**
- `DISCORD_BOT_TOKEN` — SET in `~/.config/ema/ema-daemon.env`
- `DISCORD_GUILD_ID` — SET in `~/.config/ema/ema-daemon.env`

**Evidence of active delivery:**
- `/api/babysitter/state` shows 8 active stream channels + 1 live channel, all with channel_ids and tick counts (some at 973 ticks)
- `/api/feedback/status` shows 418 events consumed, 19 delivery workers active
- `/api/feedback` returns recent events with Discord channel_ids and formatted messages (heartbeat, agent thoughts, intent stream, etc.)
- Channels include: `babysitter-live`, `system-heartbeat`, `intent-stream`, `pipeline-flow`, `agent-thoughts`, `intelligence-layer`, `memory-writes`, `execution-log`, `evolution-signals`

**Rate limiting:** Handled — 429 responses trigger sleep + retry.

**Message chunking:** Handled — messages split at 1990 chars for Discord's 2000-char limit.

---

## 2. Babysitter StreamChannels

**Status: ACTIVE, 9 streams ticking**

Stream channels build and deliver periodic system summaries to Discord channels.

| Stream | Channel | Tick Count | Interval | Status |
|--------|---------|------------|----------|--------|
| live | babysitter-live | ongoing | 60s | active |
| agent | agent-thoughts | 973 | 8s (hot) | active, hot activity |
| heartbeat | system-heartbeat | 26 | 300s | active |
| intent | intent-stream | 13 | 600s | active |
| pipeline | pipeline-flow | 26 | 300s | active |
| intelligence | intelligence-layer | 8 | 900s | active |
| memory | memory-writes | 8 | 900s | active |
| execution | execution-log | 26 | 300s | active |
| evolution | evolution-signals | 4 | 1800s | active |

**Adaptive tick policy:** The agent stream is running at 8s intervals (hot mode) due to activity_ema of 8.999 exceeding hot_threshold of 5.0. Other streams are in manual mode at their base intervals.

**Duplicate suppression:** Fingerprint-based — skips delivery when state hasn't changed (`delivery_decision/2`).

**Dormant streams:** `speculative-feed` is registered but not auto-scheduled.

**Delivery-only channels** (9 channels not ticked by babysitter but registered for delivery): critical-blockers-track, core-loop-implementation, intelligence-integrations, deliberation, prompt-lab, research-feed, code-output, alerts, ops-log.

---

## 3. Feedback System (Ema.Feedback.Supervisor)

**Status: RUNNING, DELIVERING**

The feedback system is a three-part stack:

1. **Feedback.Broadcast** — Central emit point. Dual-writes to Discord REST API + EMA internal PubSub (`"ema:feedback"`). Has hardcoded stream channel IDs for named channels.

2. **Feedback.DiscordDelivery** — DynamicSupervisor with per-channel workers. 19 workers active (one per registered channel). Workers subscribe to `"discord:outbound:<channel_id>"` and call `Broadcast.emit/4` on message receipt.

3. **Feedback.Consumer** — Subscribes to `"ema:feedback"`, writes to in-memory ring buffer (last 500 events via `:persistent_term`), re-broadcasts to `"ema:hq:feedback"` for HQ dashboard.

**Status endpoint (`/api/feedback/status`):**
- Running: true
- Received: 418 events
- Last event: 2026-04-06T05:43:24 (seconds ago at time of check)
- Store size: 418
- 19 delivery workers active

**Delivery chain is fully operational.** Events flow from StreamChannels -> PubSub -> DiscordDelivery Workers -> Broadcast -> Discord REST API + internal PubSub -> Consumer -> Store + HQ topic.

---

## 4. Pipes

**Status: FIRING but ALL RUNS FAILING**

7 pipes defined, 6 active. The Executor subscribes to PubSub trigger patterns and spawns Task.Supervisor children for execution.

| Pipe | Trigger | Active |
|------|---------|--------|
| Approved Proposal -> Task | proposals:approved | yes |
| Brain Dump -> Harvest Patterns | brain_dump:item_created | yes |
| Daily Digest Generation | system:daily | yes |
| Habit Streak Celebration | habits:streak_milestone | yes |
| New Project -> Bootstrap Vault Space | projects:created | yes |
| Project Context Auto-Rebuild | tasks:status_changed | yes |
| Responsibility Task Generation | system:daily | yes |

**Run history:** 18 total runs, ALL 18 failed. All failures are from a single pipe: `Brain Dump -> Harvest Patterns`.

**Root cause:** The pipe's action is `proposals:create_seed` with config `{"type": "brain_dump_cluster"}`. The Registry's `create_seed` action passes `%{prompt: payload["prompt"], project_id: payload["project_id"]}` to `Ema.Proposals.create_seed/1`. The brain_dump event payload contains `{"source", "content", "item_id"}` — it has no `prompt`, `project_id`, `name`, `prompt_template`, or `seed_type` fields.

**Changeset error confirms:**
```
errors: [name: {"can't be blank", [validation: :required]},
         prompt_template: {"can't be blank", [validation: :required]},
         seed_type: {"can't be blank", [validation: :required]}]
```

The pipe's action config and the registry's execute function don't map brain dump payloads to the fields required by the Seed schema. The `"type" => "brain_dump_cluster"` config key is merged into the payload but doesn't satisfy the required fields (`name`, `prompt_template`, `seed_type`).

**Fix needed:** The `proposals:create_seed` action's execute function needs to synthesize a seed from brain dump data — constructing `name`, `prompt_template`, and `seed_type` from the brain dump content. Or the pipe itself needs a `map` transform that reshapes the payload before the action runs.

**Other 6 pipes:** No runs recorded — their triggers (proposals:approved, system:daily, habits:streak_milestone, projects:created, tasks:status_changed) may not have fired, or they're working but the events haven't occurred.

---

## 5. Webhooks

**Status: CONFIGURED, routes exist**

Routes defined in router:

| Route | Controller | Purpose |
|-------|-----------|---------|
| `POST /api/webhooks/github` | WebhookController | GitHub webhook with HMAC signature verification |
| `POST /api/webhooks/slack/commands` | WebhookController | Slack slash commands |
| `POST /api/webhooks/slack/events` | WebhookController | Slack Events API (supports url_verification) |
| `POST /api/webhooks/telegram` | TelegramController | Telegram webhook |
| `POST /api/webhooks/discord` | DiscordWebhookController | Discord webhook |
| `POST /api/discord/message` | DiscordWebhookController | Voice-integrated Discord bridge |

**GitHub:** Functional implementation — verifies HMAC-SHA256 signature, dispatches to `Ema.Integrations.GitHub.Webhook`. Falls through without verification if no webhook secret configured.

**Slack:** Routes to `Ema.Integrations.Slack.Router` for both commands and events. URL verification challenge/response implemented.

**Discord:** Two endpoints — `/api/webhooks/discord` and `/api/discord/message`. The `/message` endpoint is the active bridge that routes through VoiceCore.

**Configuration unknown:** Whether GitHub/Slack webhook secrets and URLs are actually configured was not verified. These would require external services to be set up and pointing at this daemon.

---

## Summary

| Integration | Status | Delivering? | Issues |
|-------------|--------|-------------|--------|
| Discord Bridge | Connected | Yes (inbound + outbound) | None |
| Babysitter Streams | Active (9 streams) | Yes, to Discord | Agent stream hot (8s ticks) |
| Feedback System | Running (19 workers) | Yes (418 events) | None |
| Pipes | Firing | No (18/18 failed) | `create_seed` action missing required fields from brain_dump payload |
| GitHub Webhook | Route exists | Unknown | Needs external config |
| Slack Webhook | Route exists | Unknown | Needs external config |
| Telegram Webhook | Route exists | Unknown | Needs external config |
