defmodule Ema.Standards.Enforcer do
  @moduledoc """
  Background hourly checks that nudge users toward EMA best practices.

  Runs the same checks exposed via `ema standards check` and broadcasts
  any findings on the `"standards:findings"` PubSub topic so the UI and
  CLI can surface them. Findings with severity `:warn` or `:error` are
  also logged.

  See `wiki/Operations/EMA-Best-Practices.md` for the canonical reference
  on what each check enforces and why it matters.
  """

  use GenServer
  require Logger

  alias Ema.Standards.Checks

  @check_interval :timer.hours(1)
  # Wait long enough on boot for the rest of the supervision tree to be up.
  @initial_delay :timer.seconds(60)
  @topic "standards:findings"

  ## Public API

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Force a sweep right now (cast — async). Used by tests and CLI."
  def tick_now, do: GenServer.cast(__MODULE__, :check)

  @doc "Run all checks synchronously and return the list of findings."
  @spec run_all_checks() :: [Checks.finding()]
  def run_all_checks do
    Checks.all()
    |> Enum.flat_map(fn check ->
      try do
        List.wrap(check.run.())
      rescue
        e ->
          Logger.warning(
            "[Standards.Enforcer] check #{check.id} crashed: #{Exception.message(e)}"
          )

          []
      end
    end)
  end

  @doc "Lookup metadata for a single check id (atom or string)."
  @spec explain(atom() | String.t()) :: {:ok, Checks.check()} | :error
  def explain(id) when is_binary(id) do
    case Enum.find(Checks.all(), fn c -> Atom.to_string(c.id) == id end) do
      nil -> :error
      check -> {:ok, check}
    end
  end

  def explain(id) when is_atom(id) do
    case Enum.find(Checks.all(), fn c -> c.id == id end) do
      nil -> :error
      check -> {:ok, check}
    end
  end

  ## Server callbacks

  @impl true
  def init(opts) do
    interval = Keyword.get(opts, :interval, @check_interval)
    Process.send_after(self(), :check, @initial_delay)
    {:ok, %{interval: interval, last_findings: []}}
  end

  @impl true
  def handle_info(:check, state) do
    findings = do_sweep()
    Process.send_after(self(), :check, state.interval)
    {:noreply, %{state | last_findings: findings}}
  end

  @impl true
  def handle_cast(:check, state) do
    findings = do_sweep()
    {:noreply, %{state | last_findings: findings}}
  end

  defp do_sweep do
    findings = run_all_checks()
    surface(findings)
    findings
  end

  defp surface([]), do: :ok

  defp surface(findings) do
    Enum.each(findings, fn finding ->
      level =
        case finding.severity do
          :error -> :error
          :warn -> :warning
          _ -> :info
        end

      Logger.log(level, "[Standards] #{finding.check_id}: #{finding.summary}")
    end)

    Phoenix.PubSub.broadcast(Ema.PubSub, @topic, {:standards_findings, findings})
  end
end
