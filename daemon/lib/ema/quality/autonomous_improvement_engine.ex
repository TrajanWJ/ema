defmodule Ema.Quality.AutonomousImprovementEngine do
  @moduledoc """
  Hourly improvement cycle that analyzes quality gradient and friction,
  then generates improvement proposals when trends degrade.
  """

  use GenServer
  require Logger

  alias Ema.Quality.{QualityGradient, FrictionDetector}
  alias Ema.Proposals

  @cycle_interval :timer.hours(1)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def run_improvement_cycle do
    GenServer.call(__MODULE__, :run_cycle, 30_000)
  end

  def get_state do
    GenServer.call(__MODULE__, :get_state)
  end

  @impl true
  def init(_opts) do
    schedule_cycle()
    {:ok, %{last_run: nil, suggestions: [], cycle_count: 0}}
  end

  @impl true
  def handle_call(:run_cycle, _from, state) do
    new_state = do_cycle(state)
    {:reply, {:ok, new_state.suggestions}, new_state}
  end

  @impl true
  def handle_call(:get_state, _from, state) do
    {:reply, state, state}
  end

  @impl true
  def handle_info(:run_cycle, state) do
    new_state = do_cycle(state)
    schedule_cycle()
    {:noreply, new_state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp schedule_cycle do
    Process.send_after(self(), :run_cycle, @cycle_interval)
  end

  defp do_cycle(state) do
    gradient = QualityGradient.compute_gradient()
    friction = FrictionDetector.get_friction_report()

    suggestions = generate_suggestions(gradient, friction)

    Enum.each(suggestions, fn suggestion ->
      create_improvement_proposal(suggestion)
    end)

    if suggestions != [] do
      Phoenix.PubSub.broadcast(
        Ema.PubSub,
        "quality:improvement",
        {:improvements_generated, suggestions}
      )
    end

    %{
      state
      | last_run: DateTime.utc_now(),
        suggestions: suggestions,
        cycle_count: state.cycle_count + 1
    }
  end

  defp generate_suggestions(gradient, friction) do
    suggestions = []

    suggestions =
      if gradient.trend == :degrading do
        cond do
          gradient.gradient.approval_rate < -0.1 ->
            [%{type: :declining_approval, message: "Proposal approval rate declining — review quality gates"} | suggestions]

          gradient.gradient.completion_rate < -0.1 ->
            [%{type: :declining_completion, message: "Task completion rate declining — investigate blockers"} | suggestions]

          true ->
            [%{type: :general_degradation, message: "Overall quality trend degrading"} | suggestions]
        end
      else
        suggestions
      end

    suggestions =
      if friction.severity == :high do
        [%{type: :high_friction, message: "High friction detected (score: #{friction.friction_score})"} | suggestions]
      else
        suggestions
      end

    suggestions
  end

  defp create_improvement_proposal(suggestion) do
    id = "prop_imp_#{System.system_time(:second)}_#{:crypto.strong_rand_bytes(3) |> Base.encode16(case: :lower)}"

    try do
      Proposals.create_proposal(%{
        id: id,
        title: "[Auto] #{suggestion.message}",
        summary: "Auto-generated improvement suggestion: #{suggestion.message}",
        status: "queued",
        confidence: 0.5
      })
    rescue
      e ->
        Logger.warning("Failed to create improvement proposal: #{inspect(e)}")
        :error
    end
  end
end
