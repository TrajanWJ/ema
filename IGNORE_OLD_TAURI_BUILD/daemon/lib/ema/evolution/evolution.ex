defmodule Ema.Evolution do
  @moduledoc """
  Evolution context — manages behavioral rules, versioning, and rollbacks.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Evolution.BehaviorRule

  # --- Rules ---

  def list_rules(opts \\ []) do
    BehaviorRule
    |> maybe_filter_by(:status, opts[:status])
    |> maybe_filter_by(:source, opts[:source])
    |> order_by(desc: :inserted_at)
    |> maybe_limit(opts[:limit])
    |> Repo.all()
  end

  def get_rule(id), do: Repo.get(BehaviorRule, id)

  def get_active_rules do
    list_rules(status: "active")
  end

  def create_rule(attrs) do
    id = generate_id("rule")

    %BehaviorRule{}
    |> BehaviorRule.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
    |> tap_ok(&broadcast_evolution_event("rule_created", &1))
  end

  def update_rule(%BehaviorRule{} = rule, attrs) do
    rule
    |> BehaviorRule.changeset(attrs)
    |> Repo.update()
    |> tap_ok(&broadcast_evolution_event("rule_updated", &1))
  end

  def activate_rule(id) do
    case get_rule(id) do
      nil -> {:error, :not_found}
      rule -> update_rule(rule, %{status: "active"})
    end
  end

  def rollback_rule(id) do
    case get_rule(id) do
      nil ->
        {:error, :not_found}

      rule ->
        Repo.transaction(fn ->
          case update_rule(rule, %{status: "rolled_back"}) do
            {:ok, rolled_back} ->
              # If there's a previous version, reactivate it
              if rule.previous_rule_id do
                case get_rule(rule.previous_rule_id) do
                  nil ->
                    rolled_back

                  prev ->
                    update_rule(prev, %{status: "active"})
                    rolled_back
                end
              else
                rolled_back
              end

            {:error, changeset} ->
              Repo.rollback(changeset)
          end
        end)
    end
  end

  def get_version_history(id) do
    case get_rule(id) do
      nil ->
        {:error, :not_found}

      rule ->
        chain = build_version_chain(rule, [rule])
        {:ok, chain}
    end
  end

  def get_rule_with_proposal(id) do
    BehaviorRule
    |> Repo.get(id)
    |> maybe_preload([:proposal])
  end

  # --- Signals ---

  def recent_signals(limit \\ 20) do
    BehaviorRule
    |> where([r], r.source != "manual")
    |> order_by(desc: :inserted_at)
    |> limit(^limit)
    |> Repo.all()
    |> Enum.map(fn rule ->
      %{
        id: rule.id,
        source: rule.source,
        content: rule.content,
        status: rule.status,
        signal_metadata: rule.signal_metadata,
        created_at: rule.inserted_at
      }
    end)
  end

  # --- Stats ---

  def stats do
    rules = Repo.all(BehaviorRule)

    %{
      total_rules: length(rules),
      active_rules: Enum.count(rules, &(&1.status == "active")),
      proposed_rules: Enum.count(rules, &(&1.status == "proposed")),
      rolled_back_rules: Enum.count(rules, &(&1.status == "rolled_back")),
      sources: rules |> Enum.frequencies_by(& &1.source)
    }
  end

  # --- Private ---

  defp build_version_chain(%BehaviorRule{previous_rule_id: nil}, acc), do: Enum.reverse(acc)

  defp build_version_chain(%BehaviorRule{previous_rule_id: prev_id}, acc) do
    case Repo.get(BehaviorRule, prev_id) do
      nil -> Enum.reverse(acc)
      prev -> build_version_chain(prev, [prev | acc])
    end
  end

  defp maybe_filter_by(query, _field, nil), do: query

  defp maybe_filter_by(query, field, value) do
    where(query, [q], field(q, ^field) == ^value)
  end

  defp maybe_limit(query, nil), do: query
  defp maybe_limit(query, limit), do: limit(query, ^limit)

  defp maybe_preload(nil, _preloads), do: nil
  defp maybe_preload(record, preloads), do: Repo.preload(record, preloads)

  defp tap_ok({:ok, record} = result, fun) do
    fun.(record)
    result
  end

  defp tap_ok(error, _fun), do: error

  defp broadcast_evolution_event(event, rule) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "evolution:events",
      {event, rule}
    )

    EmaWeb.Endpoint.broadcast("evolution:updates", event, serialize_rule(rule))
  end

  defp serialize_rule(rule) do
    %{
      id: rule.id,
      source: rule.source,
      content: rule.content,
      status: rule.status,
      version: rule.version,
      created_at: rule.inserted_at,
      updated_at: rule.updated_at
    }
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
