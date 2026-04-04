defmodule Ema.DeliberationGate do
  @moduledoc """
  Top-level deliberation gate that intercepts tasks containing structural
  keywords in title or description. When detected, auto-creates a proposal
  for human review before the task proceeds.

  Keywords are configurable via:
    config :ema, :deliberation_gate_keywords, ["restructure", "migrate", ...]
  """

  require Logger

  @default_structural_keywords [
    "restructure",
    "migrate",
    "delete all",
    "drop table",
    "remove all",
    "rename globally",
    "refactor entire",
    "purge",
    "archive all",
    "drop",
    "truncate",
    "wipe",
    "reset"
  ]

  @doc """
  Returns the list of structural keywords checked by the gate.
  Reads from application config at runtime; falls back to compiled defaults.
  """
  def structural_keywords do
    Application.get_env(:ema, :deliberation_gate_keywords, @default_structural_keywords)
  end

  @doc """
  Checks title and description for structural keywords.

  Returns `{:needs_deliberation, proposal_id}` if any keyword is found
  (and a proposal is created), or `{:ok, :proceed}` otherwise.
  """
  def check(title, description) do
    title_lower = downcase(title)
    desc_lower = downcase(description)

    matched =
      Enum.filter(structural_keywords(), fn kw ->
        String.contains?(title_lower, kw) or String.contains?(desc_lower, kw)
      end)

    if matched == [] do
      {:ok, :proceed}
    else
      create_deliberation_proposal(title || "", matched)
    end
  end

  @doc """
  Convenience wrapper that accepts a map with `:title` and `:description` keys.
  """
  def check_task(%{title: title, description: description}) do
    check(title, description)
  end

  def check_task(%{title: title}) do
    check(title, nil)
  end

  def check_task(_), do: {:ok, :proceed}

  defp downcase(nil), do: ""
  defp downcase(str) when is_binary(str), do: String.downcase(str)

  defp create_deliberation_proposal(title, keywords) do
    attrs = %{
      title: "Deliberation required: " <> title,
      summary:
        "Auto-created by DeliberationGate. Keywords detected: " <>
          Enum.join(keywords, ", "),
      status: "queued",
      generation_log: %{"source" => "deliberation_gate", "keywords" => keywords}
    }

    case Ema.Proposals.create_proposal(attrs) do
      {:ok, proposal} ->
        Logger.info("DeliberationGate created proposal #{proposal.id} for: #{title}")
        {:needs_deliberation, proposal.id}

      {:error, changeset} ->
        Logger.error("DeliberationGate failed to create proposal: #{inspect(changeset.errors)}")
        {:ok, :proceed}
    end
  end
end
