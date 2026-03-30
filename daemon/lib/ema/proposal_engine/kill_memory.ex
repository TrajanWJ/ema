defmodule Ema.ProposalEngine.KillMemory do
  @moduledoc """
  Tracks patterns from killed proposals. Maintains an in-memory index
  of killed proposal tags and titles to flag similar future proposals.
  Subscribes to PubSub for proposal_killed events.
  """

  use GenServer

  require Logger

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Check if a proposal is similar to previously killed proposals.
  Returns {:similar, killed_ids} or :ok.
  """
  def check_similarity(proposal) do
    GenServer.call(__MODULE__, {:check, proposal})
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "proposals:events")
    killed_patterns = load_killed_patterns()
    {:ok, %{patterns: killed_patterns}}
  end

  @impl true
  def handle_call({:check, proposal}, _from, state) do
    similar =
      state.patterns
      |> Enum.filter(fn {_id, pattern} ->
        title_overlap?(proposal.title, pattern.title) ||
          tags_overlap?(proposal, pattern.tags)
      end)
      |> Enum.map(fn {id, _} -> id end)

    result = if similar == [], do: :ok, else: {:similar, similar}
    {:reply, result, state}
  end

  @impl true
  def handle_info({"proposal_killed", proposal}, state) do
    tags = Ema.Proposals.list_tags(proposal.id)

    pattern = %{
      title: proposal.title,
      tags: Enum.map(tags, fn t -> "#{t.category}:#{t.label}" end),
      killed_at: DateTime.utc_now()
    }

    patterns = Map.put(state.patterns, proposal.id, pattern)
    Logger.info("KillMemory: recorded killed pattern for #{proposal.id}")

    {:noreply, %{state | patterns: patterns}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp load_killed_patterns do
    Ema.Proposals.list_proposals(status: "killed")
    |> Enum.reduce(%{}, fn proposal, acc ->
      tags = Ema.Proposals.list_tags(proposal.id)

      pattern = %{
        title: proposal.title,
        tags: Enum.map(tags, fn t -> "#{t.category}:#{t.label}" end),
        killed_at: proposal.updated_at
      }

      Map.put(acc, proposal.id, pattern)
    end)
  end

  defp title_overlap?(title1, title2) do
    words1 = title1 |> String.downcase() |> String.split(~r/\s+/) |> MapSet.new()
    words2 = title2 |> String.downcase() |> String.split(~r/\s+/) |> MapSet.new()

    intersection = MapSet.intersection(words1, words2) |> MapSet.size()
    union = MapSet.union(words1, words2) |> MapSet.size()

    union > 0 and intersection / union > 0.5
  end

  defp tags_overlap?(_proposal, []), do: false

  defp tags_overlap?(proposal, killed_tags) do
    proposal_tags =
      case Ema.Proposals.list_tags(proposal.id) do
        tags when is_list(tags) -> Enum.map(tags, fn t -> "#{t.category}:#{t.label}" end)
        _ -> []
      end

    common = MapSet.intersection(MapSet.new(proposal_tags), MapSet.new(killed_tags))
    MapSet.size(common) >= 2
  end
end
