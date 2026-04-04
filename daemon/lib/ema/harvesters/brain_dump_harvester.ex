defmodule Ema.Harvesters.BrainDumpHarvester do
  @moduledoc """
  BrainDumpHarvester — triages unprocessed brain dump items and creates proposals
  for those that look actionable (coding tasks, decisions, research questions).
  """

  use Ema.Harvesters.Base, name: "brain_dump", interval: :timer.hours(2)

  require Logger

  alias Ema.BrainDump
  alias Ema.Proposals

  # Patterns that indicate an item needs agent action
  @actionable_patterns [
    {~r/\bfix\b|\bbug\b|\bbroken\b|\bcrash\b/i, "bug_fix", 0.8},
    {~r/\bbuild\b|\bcreate\b|\badd\b|\bimplement\b|\bmake\b/i, "build_task", 0.75},
    {~r/\brefactor\b|\bclean up\b|\bimprove\b|\boptimize\b/i, "refactor", 0.65},
    {~r/\bshould\b|\bneed to\b|\bwant to\b|\bmust\b/i, "todo", 0.6},
    {~r/\bwhy\b|\bhow does\b|\bwhat is\b|\bfigure out\b/i, "research", 0.55}
  ]

  @max_per_run 20

  @impl Ema.Harvesters.Base
  def harvester_name, do: "brain_dump"

  @impl Ema.Harvesters.Base
  def default_interval, do: :timer.hours(2)

  @impl Ema.Harvesters.Base
  def harvest(_context) do
    unprocessed = BrainDump.list_unprocessed() |> Enum.take(@max_per_run)

    if unprocessed == [] do
      {:ok, %{items_found: 0, seeds_created: 0, metadata: %{reason: "inbox_empty"}}}
    else
      {actionable, seeds_created} =
        unprocessed
        |> Enum.reduce({0, 0}, fn item, {found, created} ->
          case triage_item(item) do
            {:proposal, _} -> {found + 1, created + 1}
            :skip -> {found, created}
          end
        end)

      Logger.info("[BrainDumpHarvester] Triaged #{length(unprocessed)} items — #{actionable} actionable, #{seeds_created} proposals seeded")

      {:ok, %{
        items_found: actionable,
        seeds_created: seeds_created,
        metadata: %{items_checked: length(unprocessed)}
      }}
    end
  rescue
    e ->
      Logger.error("[BrainDumpHarvester] Error: #{inspect(e)}")
      {:error, inspect(e)}
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp triage_item(item) do
    content = item.content || ""

    match =
      Enum.find_value(@actionable_patterns, fn {pattern, type, confidence} ->
        if Regex.match?(pattern, content) do
          {type, confidence}
        end
      end)

    case match do
      {type, confidence} ->
        title = derive_title(content, type)
        result = create_proposal_from_item(item, title, type, confidence)
        {result, {type, confidence}}
        case result do
          :ok -> {:proposal, type}
          _ -> :skip
        end

      nil ->
        :skip
    end
  end

  defp create_proposal_from_item(item, title, type, confidence) do
    source_ref =
      case item.source do
        nil -> "brain_dump"
        s -> "brain_dump:#{s}"
      end

    case Proposals.create_proposal(%{
      title: title,
      body: item.content,
      summary: String.slice(item.content, 0, 200),
      source: source_ref,
      status: "pending",
      confidence: confidence,
      proposal_type: type,
      brain_dump_item_id: item.id
    }) do
      {:ok, _} -> :ok
      _ -> :error
    end
  rescue
    _ -> :error
  end

  defp derive_title(content, type) do
    # Take first sentence or 80 chars
    first_line =
      content
      |> String.split(~r/[\n.!?]/, parts: 2)
      |> List.first("")
      |> String.trim()
      |> String.slice(0, 80)

    prefix = case type do
      "bug_fix" -> "Fix: "
      "build_task" -> "Build: "
      "refactor" -> "Refactor: "
      "research" -> "Research: "
      _ -> ""
    end

    prefix <> first_line
  end
end
