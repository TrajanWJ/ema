defmodule Ema.Intents.Schematic.AuditServer do
  @moduledoc """
  Periodic background scanner for schematic contradictions.

  Walks every top-level space scope hourly and runs
  `Ema.Intents.Schematic.Contradictions.audit/1` against each. Nested
  scopes (project / subproject / intent paths) are skipped — they would
  be too expensive and would mostly produce duplicate findings.

  Manual trigger: `GenServer.cast(Ema.Intents.Schematic.AuditServer, :run_now)`.
  """

  use GenServer

  require Logger

  alias Ema.Intents.Schematic.{Contradictions, Target}

  @initial_delay :timer.minutes(5)
  @interval :timer.hours(1)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    schedule(@initial_delay)
    {:ok, %{last_run: nil, last_count: nil}}
  end

  @impl true
  def handle_info(:tick, state) do
    new_state = run_audit(state)
    schedule(@interval)
    {:noreply, new_state}
  end

  @impl true
  def handle_cast(:run_now, state) do
    {:noreply, run_audit(state)}
  end

  defp schedule(after_ms) do
    Process.send_after(self(), :tick, after_ms)
  end

  defp run_audit(state) do
    scopes = top_level_scopes()
    Logger.info("AuditServer: scanning #{length(scopes)} top-level scopes")

    total =
      Enum.reduce(scopes, 0, fn scope, acc ->
        case safe_audit(scope) do
          {:ok, n} ->
            if n > 0 do
              Logger.info("AuditServer: #{scope} → #{n} new contradiction(s)")
            end

            acc + n

          {:error, reason} ->
            Logger.warning("AuditServer: #{scope} failed: #{inspect(reason)}")
            acc
        end
      end)

    Logger.info("AuditServer: tick complete — #{total} new contradiction(s)")
    %{state | last_run: DateTime.utc_now(), last_count: total}
  end

  defp safe_audit(scope) do
    try do
      Contradictions.audit(scope)
    rescue
      e ->
        Logger.error("AuditServer: crash on #{scope}: #{inspect(e)}")
        {:error, {:crashed, e}}
    end
  end

  defp top_level_scopes do
    try do
      Target.list_paths()
      |> Enum.filter(&top_level?/1)
    rescue
      e ->
        Logger.warning("AuditServer: list_paths failed: #{inspect(e)}")
        []
    end
  end

  # Top-level scope = single segment (a space, no projects).
  defp top_level?(path) when is_binary(path) do
    not String.contains?(path, ".")
  end
end
