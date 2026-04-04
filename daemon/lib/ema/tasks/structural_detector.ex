defmodule Ema.Tasks.StructuralDetector do
  @moduledoc """
  Deliberation Gate — detects structural tasks that require a proposal
  before dispatching. Structural tasks touch large-scale or irreversible
  operations: migrations, deletes, renames, global refactors, etc.
  """

  @structural_keywords ~w[restructure migrate delete rename globally
                           refactor replace all move vault redesign
                           drop truncate purge archive wipe reset]

  @doc """
  Returns true if the description contains any structural keyword.
  """
  def structural?(description) when is_binary(description) do
    lower = String.downcase(description)
    Enum.any?(@structural_keywords, &String.contains?(lower, &1))
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
    lower = String.downcase(description)
    Enum.filter(@structural_keywords, &String.contains?(lower, &1))
  end

  def detect_keywords(_), do: []
end
