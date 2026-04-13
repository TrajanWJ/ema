defmodule Ema.Decisions do
  @moduledoc """
  Decision Log context — track decisions with context, options, and outcomes.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Decisions.Decision

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end

  def list_decisions(opts \\ []) do
    Decision
    |> maybe_filter_decided_by(opts[:decided_by])
    |> maybe_filter_min_score(opts[:min_score])
    |> order_by(desc: :inserted_at)
    |> maybe_limit(opts[:limit])
    |> Repo.all()
  end

  def get_decision(id), do: Repo.get(Decision, id)

  def create_decision(attrs) do
    id = generate_id("dec")

    %Decision{}
    |> Decision.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
    |> tap_ok(&broadcast("decision_created", &1))
  end

  def update_decision(%Decision{} = decision, attrs) do
    decision
    |> Decision.changeset(attrs)
    |> Repo.update()
    |> tap_ok(&broadcast("decision_updated", &1))
  end

  def delete_decision(%Decision{} = decision) do
    Repo.delete(decision)
    |> tap_ok(fn _ -> broadcast("decision_deleted", %{id: decision.id}) end)
  end

  def record_outcome(id, outcome, score) do
    case get_decision(id) do
      nil -> {:error, :not_found}
      decision -> update_decision(decision, %{outcome: outcome, outcome_score: score})
    end
  end

  defp maybe_filter_decided_by(query, nil), do: query
  defp maybe_filter_decided_by(query, by), do: where(query, [d], d.decided_by == ^by)

  defp maybe_filter_min_score(query, nil), do: query
  defp maybe_filter_min_score(query, min), do: where(query, [d], d.outcome_score >= ^min)

  defp maybe_limit(query, nil), do: query
  defp maybe_limit(query, n), do: limit(query, ^n)

  defp tap_ok({:ok, val} = result, fun) do
    fun.(val)
    result
  end

  defp tap_ok(error, _fun), do: error

  defp broadcast(event, payload) do
    EmaWeb.Endpoint.broadcast("decisions:lobby", event, serialize(payload))
  end

  def serialize(%Decision{} = d) do
    %{
      id: d.id,
      title: d.title,
      context: d.context,
      options: decode_json(d.options),
      chosen_option: d.chosen_option,
      decided_by: d.decided_by,
      reasoning: d.reasoning,
      outcome: d.outcome,
      outcome_score: d.outcome_score,
      tags: decode_json(d.tags),
      created_at: d.inserted_at,
      updated_at: d.updated_at
    }
  end

  def serialize(%{id: _} = map), do: map

  defp decode_json(nil), do: []

  defp decode_json(str) when is_binary(str) do
    case Jason.decode(str) do
      {:ok, val} -> val
      _ -> []
    end
  end

  defp decode_json(other), do: other
end
