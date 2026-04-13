defmodule Ema.Governance.SycophancySubscriber do
  @moduledoc """
  Listens for `{:sycophancy_alert, result}` messages on `governance:sycophancy`
  and converts each alert into a `guideline` memory entry so the next proposal
  generation cycle picks it up via Memory's context retriever.

  Without this subscriber the sycophancy detector emits broadcasts that nothing
  consumes — the warning never makes it back into the proposal pipeline.
  """

  use GenServer
  require Logger

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "governance:sycophancy")
    Logger.info("[SycophancySubscriber] Subscribed to governance:sycophancy")
    {:ok, %{}}
  end

  @impl true
  def handle_info({:sycophancy_alert, %{verdict: :alert} = result}, state) do
    record_guideline(result, importance: 0.9)
    {:noreply, state}
  end

  def handle_info({:sycophancy_alert, %{verdict: :watch} = result}, state) do
    record_guideline(result, importance: 0.7)
    {:noreply, state}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  defp record_guideline(result, opts) do
    pi = Map.get(result, :pi, 0.0) || 0.0
    importance = Keyword.get(opts, :importance, 0.8)

    content =
      "Sycophancy alert: #{round(pi * 100)}% approval rate. Be more critical and " <>
        "thoughtful in proposals — challenge assumptions, surface risks, avoid agreeing " <>
        "with weak ideas."

    attrs = %{
      memory_type: "guideline",
      scope: "global",
      content: content,
      importance: importance,
      metadata: %{"pi" => pi, "verdict" => Atom.to_string(result.verdict)}
    }

    case Ema.Memory.store_entry(attrs) do
      {:ok, _entry} ->
        Logger.info("[SycophancySubscriber] Stored guideline (pi=#{Float.round(pi, 3)})")

      {:error, reason} ->
        Logger.warning("[SycophancySubscriber] store_entry failed: #{inspect(reason)}")
    end
  rescue
    e ->
      Logger.warning("[SycophancySubscriber] record_guideline crashed: #{Exception.message(e)}")
  end
end
