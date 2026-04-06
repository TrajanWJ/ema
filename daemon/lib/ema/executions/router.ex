defmodule Ema.Executions.Router do
  @moduledoc """
  Pure classification of execution events by mode and outcome.
  No side effects. No database. No PubSub. No filesystem.

  Callers (Dispatcher, Executions) use these classifications to make
  decisions. The Router classifies — it does not decide.
  """

  @mode_phases %{
    "research" => {:exploration, 1},
    "outline" => {:specification, 2},
    "implement" => {:execution, 3},
    "review" => {:validation, 4},
    "refactor" => {:maintenance, 4},
    "harvest" => {:maintenance, 5}
  }

  @next_modes %{
    "research" => ["outline"],
    "outline" => ["implement"],
    "implement" => ["review", "refactor"],
    "review" => ["refactor", "harvest"],
    "refactor" => ["review", "harvest"],
    "harvest" => []
  }

  @spec classify(String.t(), String.t() | nil) :: map()
  def classify(mode, result_summary) do
    {mode_class, phase} = classify_mode(mode)
    signal = classify_outcome(result_summary)

    %{
      mode: mode,
      mode_class: mode_class,
      phase: phase,
      outcome_signal: signal,
      agent_role: mode_to_role(mode),
      eligible_next_modes:
        if(signal == :success, do: Map.get(@next_modes, mode, []), else: [mode])
    }
  end

  @spec classify_mode(String.t()) :: {atom(), non_neg_integer()}
  def classify_mode(mode) do
    Map.get(@mode_phases, mode, {:adhoc, 0})
  end

  @spec classify_outcome(String.t() | nil) :: :success | :partial | :failed | :unknown
  def classify_outcome(nil), do: :unknown
  def classify_outcome(""), do: :unknown

  def classify_outcome(s) do
    cond do
      String.starts_with?(s, "FAILED:") -> :failed
      String.contains?(s, "** (exit") -> :failed
      Regex.match?(~r/^ERROR:/m, s) -> :failed
      byte_size(s) < 100 -> :partial
      Regex.match?(~r/^#+ /m, s) and byte_size(s) > 200 -> :success
      byte_size(s) >= 300 -> :success
      true -> :partial
    end
  end

  @spec mode_to_role(String.t()) :: String.t()
  def mode_to_role("research"), do: "researcher"
  def mode_to_role("outline"), do: "outliner"
  def mode_to_role("review"), do: "reviewer"
  def mode_to_role("refactor"), do: "refactorer"
  def mode_to_role("harvest"), do: "harvester"
  def mode_to_role(_), do: "implementer"

  @spec mode_success_criteria(String.t()) :: [String.t()]
  def mode_success_criteria("research") do
    [
      "Durable architecture principles extracted",
      "Minimal runtime model defined",
      "Unresolved questions listed",
      "Smallest viable implementation path identified"
    ]
  end

  def mode_success_criteria("outline") do
    [
      "Filesystem structure defined",
      "Runtime schema specified",
      "Event flow documented",
      "App boundaries clear",
      "Build order established"
    ]
  end

  def mode_success_criteria(_), do: ["Objective completed", "Output written to specified files"]

  @spec mode_read_files(String.t(), String.t()) :: [String.t()]
  def mode_read_files("outline", intent_path), do: ["#{intent_path}/research.md"]
  def mode_read_files(_, _), do: []

  @spec mode_write_files(String.t(), String.t()) :: [String.t()]
  def mode_write_files("research", intent_path), do: ["#{intent_path}/research.md"]

  def mode_write_files("outline", intent_path),
    do: ["#{intent_path}/outline.md", "#{intent_path}/decisions.md"]

  def mode_write_files(_, intent_path), do: ["#{intent_path}/result.md"]

  @spec mode_system_prompt(String.t()) :: String.t()
  def mode_system_prompt("research"), do: "You are a researcher. Extract durable principles, define minimal runtime models, list unresolved questions, identify smallest viable implementation paths."
  def mode_system_prompt("outline"), do: "You are an architect. Define filesystem structure, runtime schema, event flows, app boundaries, and build order."
  def mode_system_prompt("implement"), do: "You are an implementer. Write complete, working code. Follow existing patterns. No stubs."
  def mode_system_prompt("review"), do: "You are a reviewer. Assess correctness, identify edge cases, verify constraint adherence. Be specific."
  def mode_system_prompt("refactor"), do: "You are a refactorer. Simplify without changing behavior. Remove duplication. Improve clarity."
  def mode_system_prompt("harvest"), do: "You are a harvester. Extract reusable patterns, document learnings, update knowledge base."
  def mode_system_prompt(_), do: ""

  @spec infer_mode_from_text(String.t()) :: String.t()
  def infer_mode_from_text(text) do
    t = String.downcase(text)

    cond do
      String.contains?(t, ["research", "investigate", "explore", "study"]) -> "research"
      String.contains?(t, ["refactor", "clean up", "simplify", "improve"]) -> "refactor"
      String.contains?(t, ["review", "audit", "check", "assess"]) -> "review"
      String.contains?(t, ["outline", "plan", "design", "architect"]) -> "outline"
      true -> "implement"
    end
  end
end
