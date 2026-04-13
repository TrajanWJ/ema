defmodule EmaWeb.DecisionController do
  use EmaWeb, :controller

  alias Ema.Decisions

  action_fallback EmaWeb.FallbackController

  def index(conn, _params) do
    decisions = Decisions.list_decisions() |> Enum.map(&serialize/1)
    json(conn, %{decisions: decisions})
  end

  def show(conn, %{"id" => id}) do
    case Decisions.get_decision(id) do
      nil -> {:error, :not_found}
      decision -> json(conn, %{decision: serialize(decision)})
    end
  end

  def create(conn, params) do
    attrs = %{
      title: params["title"],
      context: params["context"],
      options: params["options"] || [],
      chosen_option: params["chosen_option"],
      decided_by: params["decided_by"],
      reasoning: params["reasoning"],
      outcome: params["outcome"],
      outcome_score: params["outcome_score"],
      tags: params["tags"] || [],
      space_id: params["space_id"]
    }

    with {:ok, decision} <- Decisions.create_decision(attrs) do
      conn
      |> put_status(:created)
      |> json(serialize(decision))
    end
  end

  def update(conn, %{"id" => id} = params) do
    case Decisions.get_decision(id) do
      nil ->
        {:error, :not_found}

      decision ->
        attrs = %{
          title: params["title"],
          context: params["context"],
          options: params["options"],
          chosen_option: params["chosen_option"],
          decided_by: params["decided_by"],
          reasoning: params["reasoning"],
          outcome: params["outcome"],
          outcome_score: params["outcome_score"],
          tags: params["tags"],
          space_id: params["space_id"],
          reviewed_at: parse_datetime(params["reviewed_at"])
        }

        with {:ok, updated} <- Decisions.update_decision(decision, attrs) do
          json(conn, serialize(updated))
        end
    end
  end

  def delete(conn, %{"id" => id}) do
    case Decisions.get_decision(id) do
      nil ->
        {:error, :not_found}

      decision ->
        with {:ok, _} <- Decisions.delete_decision(decision) do
          json(conn, %{ok: true})
        end
    end
  end

  defp serialize(decision) do
    %{
      id: decision.id,
      title: decision.title,
      context: decision.context,
      options: decision.options,
      chosen_option: decision.chosen_option,
      decided_by: decision.decided_by,
      reasoning: decision.reasoning,
      outcome: decision.outcome,
      outcome_score: decision.outcome_score,
      tags: decision.tags,
      space_id: decision.space_id,
      reviewed_at: decision.reviewed_at,
      created_at: decision.inserted_at,
      updated_at: decision.updated_at
    }
  end

  defp parse_datetime(nil), do: nil

  defp parse_datetime(dt_string) when is_binary(dt_string) do
    case DateTime.from_iso8601(dt_string) do
      {:ok, dt, _offset} -> dt
      {:error, _} -> nil
    end
  end

  defp parse_datetime(_), do: nil
end
