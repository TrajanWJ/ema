defmodule Ema.Intelligence.RouteTrace do
  @moduledoc """
  Traces routing decisions for debugging and observability.

  Writes to Logger with a consistent format. All decisions are tagged
  with event type, channel, and target so they can be grepped easily.

  Usage:
    RouteTrace.log(event, {:hub, :proposal_orchestrator, enriched})
    RouteTrace.log(event, {:domain, :journal_agent, enriched})
  """

  require Logger

  @doc "Log a routing decision."
  def log(event, {:hub, target, enriched}) do
    Logger.info(
      "[RouteTrace] event=#{event.type} channel=hub target=#{target} " <>
        "keys=#{context_key_summary(enriched)}"
    )
  end

  def log(event, {:domain, agent, enriched}) do
    Logger.info(
      "[RouteTrace] event=#{event.type} channel=domain agent=#{agent} " <>
        "keys=#{context_key_summary(enriched)}"
    )
  end

  def log(event, {:error, reason}) do
    Logger.warning("[RouteTrace] event=#{event.type} routing_error=#{inspect(reason)}")
  end

  def log(event, other) do
    Logger.debug("[RouteTrace] event=#{inspect(event.type)} decision=#{inspect(other)}")
  end

  defp context_key_summary(enriched) do
    context = Map.get(enriched, :context, %{})
    context |> Map.keys() |> Enum.join(",")
  rescue
    _ -> "unknown"
  end
end
