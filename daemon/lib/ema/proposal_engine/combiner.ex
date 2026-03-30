defmodule Ema.ProposalEngine.Combiner do
  @moduledoc """
  Periodic GenServer that scans queued proposals for overlapping tags
  and creates cross-pollination seeds to synthesize related ideas.
  """

  use GenServer

  require Logger

  @scan_interval :timer.hours(1)

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def scan_now do
    GenServer.cast(__MODULE__, :scan)
  end

  # --- Server ---

  @impl true
  def init(opts) do
    unless Keyword.get(opts, :skip_timer, false) do
      schedule_scan()
    end

    {:ok, %{last_scan_at: nil, combinations_created: 0}}
  end

  @impl true
  def handle_cast(:scan, state) do
    state = do_scan(state)
    {:noreply, state}
  end

  @impl true
  def handle_info(:scan, state) do
    state = do_scan(state)
    schedule_scan()
    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp schedule_scan do
    Process.send_after(self(), :scan, @scan_interval)
  end

  defp do_scan(state) do
    proposals = Ema.Proposals.list_proposals(status: "queued")

    # Build tag -> proposals index
    tag_index =
      Enum.reduce(proposals, %{}, fn proposal, acc ->
        tags = Ema.Proposals.list_tags(proposal.id)

        Enum.reduce(tags, acc, fn tag, inner_acc ->
          key = "#{tag.category}:#{tag.label}"
          Map.update(inner_acc, key, [proposal], &[proposal | &1])
        end)
      end)

    # Find clusters (2+ proposals sharing a tag)
    clusters =
      tag_index
      |> Enum.filter(fn {_tag, proposals} -> length(proposals) >= 2 end)
      |> Enum.map(fn {tag, proposals} -> {tag, Enum.take(proposals, 3)} end)

    created =
      Enum.count(clusters, fn {tag, cluster_proposals} ->
        create_cross_pollination_seed(tag, cluster_proposals)
      end)

    now = DateTime.utc_now() |> DateTime.truncate(:second)

    %{
      state
      | last_scan_at: now,
        combinations_created: state.combinations_created + created
    }
  end

  defp create_cross_pollination_seed(tag, proposals) do
    project_id = List.first(proposals).project_id

    attrs = %{
      name: "Cross-pollination: #{tag}",
      prompt_template: """
      These proposals share the tag "#{tag}" and may have synergies:

      #{Enum.map_join(proposals, "\n\n", fn p -> "### #{p.title}\n#{p.summary}" end)}

      Design something that combines their strengths into a unified approach.
      Output JSON with: title, summary, body, estimated_scope, risks (array), benefits (array).
      """,
      seed_type: "cross",
      project_id: project_id
    }

    case Ema.Proposals.create_seed(attrs) do
      {:ok, seed} ->
        Logger.info("Combiner: created cross-pollination seed #{seed.id} for tag #{tag}")
        true

      {:error, reason} ->
        Logger.warning("Combiner: failed to create seed: #{inspect(reason)}")
        false
    end
  end
end
