defmodule Ema.BrainDump.ProposalSurfacer do
  @moduledoc """
  Surfaces ready IntentClusters as proposal seeds.

  When ClusterEvaluator determines a cluster has crossed the readiness
  threshold, this module:
  1. Builds a structured prompt template from the cluster's member items
  2. Creates a proposal Seed (type "brain_dump") pointing at the cluster
  3. Marks the cluster as promoted and links the seed_id
  4. Stamps surfaced_proposal_id on each member item
  """

  require Logger

  alias Ema.Repo
  alias Ema.BrainDump.Item
  alias Ema.Intelligence.IntentCluster

  import Ecto.Query

  @doc """
  Surface a ready cluster as a proposal seed.
  Returns {:ok, seed} or {:error, reason}.
  """
  def surface(%IntentCluster{status: "promoted"} = cluster) do
    Logger.debug("[ProposalSurfacer] cluster #{cluster.id} already promoted, skipping")
    {:ok, :already_promoted}
  end

  def surface(%IntentCluster{} = cluster) do
    items = fetch_cluster_items(cluster.id)

    if items == [] do
      Logger.warning("[ProposalSurfacer] cluster #{cluster.id} has no linked items")
      {:error, :no_items}
    else
      case create_seed_from_cluster(cluster, items) do
        {:ok, seed} ->
          mark_cluster_promoted(cluster, seed.id)
          mark_items_surfaced(items, seed.id)

          Ema.Pipes.EventBus.broadcast_event("brain_dump:cluster_surfaced", %{
            cluster_id: cluster.id,
            seed_id: seed.id,
            item_count: length(items)
          })

          Logger.info(
            "[ProposalSurfacer] surfaced cluster #{cluster.id} as seed #{seed.id} " <>
              "(#{length(items)} items)"
          )

          {:ok, seed}

        {:error, reason} ->
          Logger.warning(
            "[ProposalSurfacer] failed to create seed for cluster #{cluster.id}: #{inspect(reason)}"
          )

          {:error, reason}
      end
    end
  end

  # --- Private ---

  defp fetch_cluster_items(cluster_id) do
    Item
    |> where([i], i.cluster_id == ^cluster_id)
    |> order_by(asc: :inserted_at)
    |> Repo.all()
  end

  defp create_seed_from_cluster(cluster, items) do
    prompt_template = build_prompt_template(cluster, items)

    Ema.Proposals.create_seed(%{
      name: "Brain dump cluster: #{String.slice(cluster.label, 0, 60)}",
      prompt_template: prompt_template,
      seed_type: "brain_dump",
      schedule: "once",
      active: true,
      metadata: %{
        cluster_id: cluster.id,
        item_ids: Enum.map(items, & &1.id),
        item_count: length(items),
        readiness_score: cluster.readiness_score
      },
      context_injection: %{
        cluster_label: cluster.label,
        cluster_description: cluster.description
      }
    })
  end

  defp build_prompt_template(cluster, items) do
    item_block =
      items
      |> Enum.with_index(1)
      |> Enum.map(fn {item, idx} ->
        ts = if item.inserted_at, do: Calendar.strftime(item.inserted_at, "%Y-%m-%d %H:%M"), else: "unknown"
        "#{idx}. [#{ts}] #{item.content}"
      end)
      |> Enum.join("\n")

    """
    You are EMA, an AI chief of staff. A cluster of related brain dump items has \
    formed, suggesting a recurring theme worth turning into a concrete proposal.

    ## Cluster: #{cluster.label}

    #{cluster.description}

    ## Raw items (#{length(items)} total):

    #{item_block}

    ## Your task

    Synthesize these related thoughts into a single actionable proposal. Include:
    1. A clear title (5-10 words)
    2. A summary paragraph explaining what this is and why it matters
    3. Concrete next steps (3-5 bullets)
    4. Estimated effort (hours or days)
    5. Which existing project this might belong to, if any

    Respond with structured JSON:
    {
      "title": "...",
      "summary": "...",
      "body": "...",
      "next_steps": ["..."],
      "effort_estimate": "...",
      "suggested_project": "..." or null
    }
    """
  end

  defp mark_cluster_promoted(cluster, seed_id) do
    cluster
    |> IntentCluster.changeset(%{
      status: "promoted",
      promoted: true,
      seed_id: seed_id
    })
    |> Repo.update()
  end

  defp mark_items_surfaced(items, seed_id) do
    item_ids = Enum.map(items, & &1.id)

    Item
    |> where([i], i.id in ^item_ids)
    |> Repo.update_all(set: [surfaced_proposal_id: seed_id])
  end
end
