defmodule Ema.Intelligence.OutcomeSubscriber do
  @moduledoc """
  Subscribes to `intelligence:outcomes` and persists every `:outcome_logged`
  event as a typed memory entry. This is what makes outcome events show up in
  the next Claude prompt — `Ema.Claude.ContextManager` doesn't subscribe to
  PubSub directly; it pulls from `Ema.Memory` on every prompt build.

  Without this subscriber the multiple broadcasters that publish on
  `intelligence:outcomes` (`IntelligenceController`, `Sycophancy.audit_and_alert/1`,
  `CostAlertHandler`, `LoopEventHandler`, etc.) write to the void.

  Importance is taken from the payload when present, otherwise defaults to
  `0.5`. The memory_type is derived from `payload.kind`:

    * `cost_tier_change`         → `guideline`
    * `loop_escalated`           → `error_pattern`
    * `loop_closed`              → `decision`
    * `sycophancy_audit`         → `guideline`
    * `*_decomposed` and others  → `decision`
    * fallback                   → `decision`
  """

  use GenServer
  require Logger

  @topic "intelligence:outcomes"

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, @topic)
    Logger.info("[OutcomeSubscriber] Subscribed to #{@topic}")
    {:ok, %{seen: 0}}
  end

  @impl true
  def handle_info({:outcome_logged, payload}, state) when is_map(payload) do
    persist(payload)
    {:noreply, %{state | seen: state.seen + 1}}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  # ── Internal ─────────────────────────────────────────────────────────────

  defp persist(payload) do
    kind = stringify(payload[:kind] || payload["kind"] || "outcome")
    importance = clamp(payload[:importance] || payload["importance"] || 0.5)

    attrs = %{
      memory_type: memory_type_for(kind),
      scope: "global",
      content: render(kind, payload),
      importance: importance,
      metadata: stringify_keys(payload)
    }

    case Ema.Memory.store_entry(attrs) do
      {:ok, _entry} -> :ok
      {:error, reason} -> Logger.debug("[OutcomeSubscriber] store_entry failed: #{inspect(reason)}")
    end
  rescue
    e -> Logger.debug("[OutcomeSubscriber] persist crashed: #{Exception.message(e)}")
  end

  defp render(kind, payload) do
    summary =
      payload
      |> Map.drop([:kind, "kind", :importance, "importance", :logged_at, "logged_at"])
      |> Enum.map(fn {k, v} -> "#{k}=#{inspect(v)}" end)
      |> Enum.join(" ")

    "Outcome [#{kind}]: #{summary}"
  end

  defp memory_type_for("cost_tier_change"), do: "guideline"
  defp memory_type_for("sycophancy_audit"), do: "guideline"
  defp memory_type_for("loop_escalated"), do: "error_pattern"
  defp memory_type_for("loop_closed"), do: "decision"
  defp memory_type_for("loop_opened"), do: "context"
  defp memory_type_for("loop_touched"), do: "context"
  defp memory_type_for("proposal_decomposed"), do: "decision"
  defp memory_type_for(_), do: "decision"

  defp clamp(n) when is_number(n), do: n |> max(0.0) |> min(1.0)
  defp clamp(_), do: 0.5

  defp stringify(v) when is_atom(v), do: Atom.to_string(v)
  defp stringify(v) when is_binary(v), do: v
  defp stringify(v), do: inspect(v)

  defp stringify_keys(map) do
    Map.new(map, fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), stringify_value(v)}
      {k, v} -> {to_string(k), stringify_value(v)}
    end)
  end

  defp stringify_value(v) when is_atom(v) and not is_boolean(v) and not is_nil(v),
    do: Atom.to_string(v)

  defp stringify_value(v), do: v
end
