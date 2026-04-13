defmodule Ema.Evolution.Proposer do
  @moduledoc """
  Converts detected evolution signals into proposals using the existing
  proposal engine pipeline. Creates evolution-type proposals with signal
  metadata attached.
  """

  use GenServer

  require Logger

  alias Ema.Evolution
  alias Ema.Evolution.InstructionParser

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def propose_from_signal(source, metadata) do
    GenServer.cast(__MODULE__, {:propose, source, metadata})
  end

  def propose_manual(instruction) do
    GenServer.cast(__MODULE__, {:propose_manual, instruction})
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "evolution:signals")
    {:ok, %{total_proposed: 0}}
  end

  @impl true
  def handle_cast({:propose, source, metadata}, state) do
    Task.Supervisor.start_child(Ema.Evolution.TaskSupervisor, fn ->
      do_propose(source, metadata)
    end)

    {:noreply, %{state | total_proposed: state.total_proposed + 1}}
  end

  @impl true
  def handle_cast({:propose_manual, instruction}, state) do
    Task.Supervisor.start_child(Ema.Evolution.TaskSupervisor, fn ->
      do_propose_manual(instruction)
    end)

    {:noreply, %{state | total_proposed: state.total_proposed + 1}}
  end

  @impl true
  def handle_info({:evolution_signal, source, metadata}, state) do
    Task.Supervisor.start_child(Ema.Evolution.TaskSupervisor, fn ->
      do_propose(source, metadata)
    end)

    {:noreply, %{state | total_proposed: state.total_proposed + 1}}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  # --- Private ---

  defp do_propose(source, metadata) do
    # InstructionParser.parse_signal/2 always returns {:ok, _} (falls back
    # to a basic parse when Claude is unavailable), so no error clause needed.
    {:ok, parsed} = InstructionParser.parse_signal(source, metadata)
    create_evolution_proposal(parsed, source, metadata)
  end

  defp do_propose_manual(instruction) do
    # InstructionParser.parse/1 always returns {:ok, _} via fallback_parse.
    {:ok, parsed} = InstructionParser.parse(instruction)
    create_evolution_proposal(parsed, :manual, %{instruction: instruction})
  end

  defp create_evolution_proposal(parsed, source, metadata) do
    # Create a seed that goes through the regular pipeline
    seed_attrs = %{
      name: "Evolution: #{String.slice(parsed.content, 0..60)}",
      prompt_template: build_evolution_prompt(parsed),
      seed_type: "session",
      metadata: %{
        evolution: true,
        signal_source: to_string(source),
        signal_metadata: metadata,
        parsed_rule: parsed
      }
    }

    case Ema.Proposals.create_seed(seed_attrs) do
      {:ok, seed} ->
        Logger.info("Proposer: created evolution seed #{seed.id}")
        # Dispatch to the generator immediately
        Ema.ProposalEngine.Generator.generate(seed)

        # Also create a behavior rule in proposed state
        rule_attrs = %{
          source: parsed.source,
          content: parsed.content,
          status: "proposed",
          signal_metadata: metadata
        }

        case Evolution.create_rule(rule_attrs) do
          {:ok, rule} ->
            Logger.info("Proposer: created proposed rule #{rule.id}")

          {:error, reason} ->
            Logger.warning("Proposer: failed to create rule: #{inspect(reason)}")
        end

      {:error, reason} ->
        Logger.warning("Proposer: failed to create seed: #{inspect(reason)}")
    end
  end

  defp build_evolution_prompt(parsed) do
    """
    You are proposing a behavioral evolution for the EMA system.

    Detected rule: #{parsed.content}

    Rationale: #{parsed.rationale}

    #{if parsed.conditions != [], do: "Conditions: #{Enum.join(parsed.conditions, ", ")}", else: ""}
    #{if parsed.actions != [], do: "Actions: #{Enum.join(parsed.actions, ", ")}", else: ""}

    Generate a concrete proposal for implementing this behavioral change.
    Consider: what changes, what stays the same, rollback plan, metrics for success.

    Output JSON with fields: title, summary, body, estimated_scope, risks, benefits.
    """
  end
end
