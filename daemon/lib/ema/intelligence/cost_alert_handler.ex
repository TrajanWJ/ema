defmodule Ema.Intelligence.CostAlertHandler do
  @moduledoc """
  Subscribes to `system:alerts` and reacts to cost-tier changes broadcast by
  `Ema.Intelligence.CostGovernor`.

  Without this handler the governor's tier-change broadcast is a tree falling
  in an empty forest. This module turns the broadcast into:

    * a `Memory` guideline entry so the next Claude prompt knows the system is
      degraded (`importance: 0.9` for hard tiers, `0.7` otherwise)
    * an audit-log row in `audit_logs` for retroactive review
    * a re-broadcast on `intelligence:outcomes` so any outcome-aware listener
      (dashboards, the wiki summarizer, etc.) can pick it up

  The CostGovernor still owns the actual mitigation (auto-pausing the proposal
  engine, downgrading to haiku, etc.). This handler is observability-only —
  duplicating the mitigation here would race with the governor.
  """

  use GenServer
  require Logger

  alias Ema.Intelligence.AuditLog
  alias Ema.Repo

  @topic "system:alerts"

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, @topic)
    Logger.info("[CostAlertHandler] Subscribed to #{@topic}")
    {:ok, %{}}
  end

  @impl true
  def handle_info({:cost_tier_changed, %{} = payload}, state) do
    record(payload)
    {:noreply, state}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  # ── Internal ─────────────────────────────────────────────────────────────

  defp record(payload) do
    importance = importance_for(payload[:new_tier])
    label = payload[:label] || "tier change"
    msg = payload[:message] || "Cost tier changed: #{payload[:old_tier]} → #{payload[:new_tier]}"

    store_memory(payload, importance, label, msg)
    write_audit_log(payload)
    rebroadcast_outcome(payload, importance)
  rescue
    e ->
      Logger.warning("[CostAlertHandler] record crashed: #{Exception.message(e)}")
  end

  defp store_memory(payload, importance, label, msg) do
    attrs = %{
      memory_type: "guideline",
      scope: "global",
      content:
        "Budget tier #{payload[:new_tier]} active (#{label}). #{msg} " <>
          "Daily spend $#{payload[:daily_spend]} of $#{payload[:daily_budget]}. " <>
          "Be sparing with model calls until tier returns to :normal.",
      importance: importance,
      metadata: %{
        "kind" => "cost_tier_change",
        "old_tier" => to_string(payload[:old_tier] || ""),
        "new_tier" => to_string(payload[:new_tier] || ""),
        "daily_spend" => payload[:daily_spend],
        "daily_budget" => payload[:daily_budget]
      }
    }

    case Ema.Memory.store_entry(attrs) do
      {:ok, _entry} ->
        Logger.info("[CostAlertHandler] Memory entry stored for tier #{payload[:new_tier]}")

      {:error, reason} ->
        Logger.warning("[CostAlertHandler] store_entry failed: #{inspect(reason)}")
    end
  end

  defp write_audit_log(payload) do
    %AuditLog{}
    |> AuditLog.changeset(%{
      action: "cost_tier_changed",
      actor: "cost_governor",
      resource: "budget",
      details: %{
        "old_tier" => to_string(payload[:old_tier] || ""),
        "new_tier" => to_string(payload[:new_tier] || ""),
        "label" => payload[:label],
        "message" => payload[:message],
        "daily_spend" => payload[:daily_spend],
        "daily_budget" => payload[:daily_budget]
      }
    })
    |> Repo.insert()
  end

  defp rebroadcast_outcome(payload, importance) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "intelligence:outcomes",
      {:outcome_logged,
       %{
         kind: "cost_tier_change",
         importance: importance,
         old_tier: to_string(payload[:old_tier] || ""),
         new_tier: to_string(payload[:new_tier] || ""),
         daily_spend: payload[:daily_spend],
         daily_budget: payload[:daily_budget],
         logged_at: DateTime.utc_now() |> DateTime.to_iso8601()
       }}
    )
  rescue
    _ -> :ok
  end

  defp importance_for(tier) when tier in [:hard_stop, :agent_only], do: 0.95
  defp importance_for(tier) when tier in [:downgrade_models, :pause_engine], do: 0.8
  defp importance_for(:normal), do: 0.5
  defp importance_for(_), do: 0.7
end
