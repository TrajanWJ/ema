defmodule Ema.BrainDump.ClusterEvaluator do
  @moduledoc """
  Periodic GenServer that groups unprocessed brain dump items by embedding
  similarity, creating and updating IntentClusters. When a cluster
  reaches the readiness threshold it is handed to ProposalSurfacer.

  Runs every 5 minutes. Only considers items with embedding_status "ready".
  """

  use GenServer

  require Logger

  alias Ema.Repo
  alias Ema.BrainDump.Item
  alias Ema.Intelligence.IntentCluster
  alias Ema.Vectors.Index

  import Ecto.Query

  @eval_interval :timer.minutes(5)
  @similarity_threshold 0.65
  @readiness_threshold 0.7
  @min_cluster_size 2
  @intent_node_id "int_1775263899832_a3587b10"

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Trigger an immediate evaluation pass."
  def evaluate_now do
    GenServer.cast(__MODULE__, :evaluate)
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    schedule_eval()
    {:ok, %{last_run: nil, clusters_formed: 0}}
  end

  @impl true
  def handle_cast(:evaluate, state) do
    new_state = run_evaluation(state)
    {:noreply, new_state}
  end

  @impl true
  def handle_info(:periodic_eval, state) do
    new_state = run_evaluation(state)
    schedule_eval()
    {:noreply, new_state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # --- Evaluation Logic ---

  defp run_evaluation(state) do
    items = fetch_embeddable_items()

    if length(items) < @min_cluster_size do
      %{state | last_run: DateTime.utc_now()}
    else
      clusters = build_clusters(items)
      persisted = persist_clusters(clusters)

      # Surface any clusters that crossed the readiness threshold
      Enum.each(persisted, fn cluster ->
        if cluster.readiness_score >= @readiness_threshold and cluster.status == "ready" do
          Ema.BrainDump.ProposalSurfacer.surface(cluster)
        end
      end)

      %{
        state
        | last_run: DateTime.utc_now(),
          clusters_formed: state.clusters_formed + length(persisted)
      }
    end
  end

  defp fetch_embeddable_items do
    Item
    |> where([i], i.embedding_status == "ready" and i.processed == false)
    |> where([i], not is_nil(i.embedding))
    |> order_by(asc: :inserted_at)
    |> Repo.all()
  end

  @doc """
  Greedy single-linkage clustering. For each item, find the best existing
  cluster (by cosine similarity to centroid). If above threshold, add to
  cluster; otherwise start a new one.
  """
  def build_clusters(items) do
    items_with_vectors =
      Enum.map(items, fn item ->
        case Index.deserialize_embedding(item.embedding) do
          {:ok, vector} -> {item, vector}
          :error -> nil
        end
      end)
      |> Enum.reject(&is_nil/1)

    {clusters, _} =
      Enum.reduce(items_with_vectors, {[], []}, fn {item, vector}, {clusters, centroids} ->
        best_match =
          centroids
          |> Enum.with_index()
          |> Enum.map(fn {{centroid, _ids}, idx} ->
            {idx, Index.cosine_similarity(vector, centroid)}
          end)
          |> Enum.max_by(fn {_idx, sim} -> sim end, fn -> {nil, 0.0} end)

        case best_match do
          {idx, sim} when not is_nil(idx) and sim >= @similarity_threshold ->
            # Merge into existing cluster
            {centroid, ids} = Enum.at(centroids, idx)
            new_count = length(ids) + 1
            # Update centroid as running mean
            new_centroid =
              Enum.zip(centroid, vector)
              |> Enum.map(fn {c, v} -> c + (v - c) / new_count end)

            updated_centroids =
              List.replace_at(centroids, idx, {new_centroid, [item.id | ids]})

            updated_clusters =
              List.update_at(clusters, idx, fn cluster ->
                Map.update!(cluster, :items, &[item | &1])
              end)

            {updated_clusters, updated_centroids}

          _ ->
            # Start new cluster
            new_cluster = %{items: [item], centroid: vector}
            {clusters ++ [new_cluster], centroids ++ [{vector, [item.id]}]}
        end
      end)

    # Filter out single-item clusters
    Enum.filter(clusters, fn c -> length(c.items) >= @min_cluster_size end)
  end

  defp persist_clusters(clusters) do
    Enum.map(clusters, fn cluster ->
      fingerprint = compute_fingerprint(cluster.items)
      item_count = length(cluster.items)

      readiness = compute_readiness(cluster)
      status = if readiness >= @readiness_threshold, do: "ready", else: "forming"

      centroid_bin = Index.serialize_embedding(cluster.centroid)

      # Build a label from the first few items
      label =
        cluster.items
        |> Enum.take(3)
        |> Enum.map(fn i -> String.slice(i.content, 0, 40) end)
        |> Enum.join(" / ")
        |> String.slice(0, 120)

      attrs = %{
        label: label,
        description: build_description(cluster.items),
        readiness_score: readiness,
        item_count: item_count,
        status: status,
        source_fingerprint: fingerprint,
        centroid_embedding: centroid_bin,
        last_evaluated_at: DateTime.utc_now(),
        intent_node_id: @intent_node_id
      }

      case Repo.get_by(IntentCluster, source_fingerprint: fingerprint) do
        nil ->
          id = "ic_#{System.system_time(:millisecond)}_#{:crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)}"

          %IntentCluster{}
          |> IntentCluster.changeset(Map.put(attrs, :id, id))
          |> Repo.insert!()

        existing ->
          # Don't re-promote already promoted clusters
          attrs =
            if existing.status in ["promoted", "dismissed"],
              do: Map.delete(attrs, :status),
              else: attrs

          existing
          |> IntentCluster.changeset(attrs)
          |> Repo.update!()
      end
      |> tap(fn cluster_record ->
        # Link items to this cluster
        item_ids = Enum.map(cluster.items, & &1.id)

        Item
        |> where([i], i.id in ^item_ids)
        |> Repo.update_all(set: [cluster_id: cluster_record.id])
      end)
    end)
  end

  defp compute_fingerprint(items) do
    items
    |> Enum.map(& &1.id)
    |> Enum.sort()
    |> Enum.join(",")
    |> then(&:crypto.hash(:sha256, &1))
    |> Base.encode16(case: :lower)
    |> String.slice(0, 32)
  end

  defp compute_readiness(cluster) do
    count = length(cluster.items)
    # Readiness is based on cluster size, capped at 1.0
    # 2 items = 0.4, 3 = 0.6, 4 = 0.8, 5+ = 1.0
    min(count * 0.2, 1.0)
  end

  defp build_description(items) do
    items
    |> Enum.map(fn i -> "- #{String.slice(i.content, 0, 80)}" end)
    |> Enum.join("\n")
  end

  defp schedule_eval do
    Process.send_after(self(), :periodic_eval, @eval_interval)
  end
end
