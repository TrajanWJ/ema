defmodule Ema.Tasks.StructuralDetector do
  @moduledoc """
  Deliberation Gate — detects structural tasks that require a proposal
  before dispatching. Structural tasks touch large-scale or irreversible
  operations: migrations, deletes, renames, global refactors, etc.
  """

  @structural_keywords ~w[restructure migrate delete rename globally
                           refactor replace all move redesign
                           drop truncate purge archive wipe reset]

  # Compiled regex patterns with word boundaries — prevents "all" matching "install"
  @structural_patterns Enum.map(@structural_keywords, fn kw ->
    Regex.compile!("\\b#{kw}\\b", "i")
  end)

  @doc """
  Returns true if the description contains any structural keyword as a whole word.
  Requires 2+ keyword matches to trigger — single matches are usually false positives.
  """
  def structural?(description) when is_binary(description) do
    match_count = Enum.count(@structural_patterns, &Regex.match?(&1, description))
    match_count >= 2
  end

  def structural?(_), do: false

  @doc """
  Routes a task through the deliberation gate.
  Returns {:require_proposal, task} or {:direct_dispatch, task}.
  """
  def route(task) do
    if structural?(task.description),
      do: {:require_proposal, task},
      else: {:direct_dispatch, task}
  end

  @doc """
  Returns the list of structural keywords found in the description.
  """
  def detect_keywords(description) when is_binary(description) do
    @structural_keywords
    |> Enum.zip(@structural_patterns)
    |> Enum.filter(fn {_kw, pattern} -> Regex.match?(pattern, description) end)
    |> Enum.map(fn {kw, _} -> kw end)
  end

  def detect_keywords(_), do: []
end
