defmodule Ema.Loops.LoopEventHandler do
  @moduledoc """
  Subscribes to `loops:lobby` and converts loop lifecycle events into durable
  signals so the rest of EMA can react to them:

    * `:loop_opened`     — light-touch memory `context` entry (importance 0.4)
    * `:loop_touched`    — no DB write (would be noisy); just rebroadcast as
                           an outcome event for live dashboards
    * `:loop_closed`     — `decision` memory entry (importance 0.6)
    * `:loop_escalated`  — `error_pattern` memory entry; importance scales
                           with `escalation_level` (level 2 → 0.8, level 3 → 0.95)

  Without this handler the four `Phoenix.PubSub.broadcast` calls in
  `Ema.Loops` go nowhere — open loops vanish into the SQLite table with no
  feedback into Memory or the babysitter visibility hub.
  """

  use GenServer
  require Logger

  alias Ema.Loops.Loop

  @topic "loops:lobby"

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, @topic)
    Logger.info("[LoopEventHandler] Subscribed to #{@topic}")
    {:ok, %{}}
  end

  @impl true
  def handle_info({:loop_opened, %Loop{} = loop}, state) do
    safe_store(%{
      memory_type: "context",
      scope: "project",
      content:
        "Loop opened: #{loop.loop_type} → #{loop.target}. " <>
          (loop.follow_up_text || ""),
      importance: 0.4,
      project_id: loop.project_id,
      actor_id: loop.actor_id,
      metadata: loop_metadata(loop, "opened")
    })

    rebroadcast(loop, "loop_opened", 0.4)
    {:noreply, state}
  end

  def handle_info({:loop_touched, %Loop{} = loop}, state) do
    # Touches are intentionally NOT persisted to memory (too noisy).
    # We still surface them on intelligence:outcomes for live UIs.
    rebroadcast(loop, "loop_touched", 0.3)
    {:noreply, state}
  end

  def handle_info({:loop_closed, %Loop{} = loop}, state) do
    safe_store(%{
      memory_type: "decision",
      scope: "project",
      content:
        "Loop closed (#{loop.status}): #{loop.loop_type} → #{loop.target}. " <>
          "Reason: #{loop.closed_reason || "n/a"}.",
      importance: 0.6,
      project_id: loop.project_id,
      actor_id: loop.actor_id,
      metadata: loop_metadata(loop, "closed")
    })

    rebroadcast(loop, "loop_closed", 0.6)
    {:noreply, state}
  end

  def handle_info({:loop_escalated, %Loop{escalation_level: level} = loop}, state)
      when is_integer(level) and level >= 2 do
    importance = if level >= 3, do: 0.95, else: 0.8

    safe_store(%{
      memory_type: "error_pattern",
      scope: "project",
      content:
        "Loop escalated to level #{level}: #{loop.loop_type} → #{loop.target}. " <>
          "Open for #{Loop.age_days(loop)} days. " <>
          "Stale follow-up — investigate or force-close.",
      importance: importance,
      project_id: loop.project_id,
      actor_id: loop.actor_id,
      metadata: loop_metadata(loop, "escalated")
    })

    rebroadcast(loop, "loop_escalated", importance)
    {:noreply, state}
  end

  # Level 0/1 escalations: rebroadcast only — not signal-worthy enough for memory.
  def handle_info({:loop_escalated, %Loop{} = loop}, state) do
    rebroadcast(loop, "loop_escalated", 0.4)
    {:noreply, state}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  # ── Internal ─────────────────────────────────────────────────────────────

  defp safe_store(attrs) do
    case Ema.Memory.store_entry(attrs) do
      {:ok, _entry} -> :ok
      {:error, reason} -> Logger.warning("[LoopEventHandler] store_entry failed: #{inspect(reason)}")
    end
  rescue
    e -> Logger.warning("[LoopEventHandler] safe_store crashed: #{Exception.message(e)}")
  end

  defp loop_metadata(%Loop{} = loop, phase) do
    %{
      "kind" => "loop_#{phase}",
      "loop_id" => loop.id,
      "loop_type" => loop.loop_type,
      "target" => loop.target,
      "channel" => loop.channel,
      "escalation_level" => loop.escalation_level,
      "touch_count" => loop.touch_count,
      "status" => loop.status
    }
  end

  defp rebroadcast(%Loop{} = loop, kind, importance) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "intelligence:outcomes",
      {:outcome_logged,
       %{
         kind: kind,
         importance: importance,
         loop_id: loop.id,
         loop_type: loop.loop_type,
         target: loop.target,
         escalation_level: loop.escalation_level,
         status: loop.status,
         logged_at: DateTime.utc_now() |> DateTime.to_iso8601()
       }}
    )
  rescue
    _ -> :ok
  end
end
