defmodule EmaWeb.SeedController do
  use EmaWeb, :controller

  alias Ema.Proposals

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_put(:project_id, params["project_id"])
      |> maybe_put(:active, parse_bool(params["active"]))
      |> maybe_put(:seed_type, params["seed_type"])

    seeds = Proposals.list_seeds(opts) |> Enum.map(&serialize_seed/1)
    json(conn, %{seeds: seeds})
  end

  def show(conn, %{"id" => id}) do
    case Proposals.get_seed(id) do
      nil -> {:error, :not_found}
      seed -> json(conn, serialize_seed(seed))
    end
  end

  def create(conn, params) do
    attrs = %{
      name: params["name"],
      prompt_template: params["prompt_template"],
      seed_type: params["seed_type"],
      schedule: params["schedule"],
      active: params["active"],
      context_injection: params["context_injection"],
      metadata: params["metadata"],
      project_id: params["project_id"]
    }

    with {:ok, seed} <- Proposals.create_seed(attrs) do
      conn
      |> put_status(:created)
      |> json(serialize_seed(seed))
    end
  end

  def update(conn, %{"id" => id} = params) do
    case Proposals.get_seed(id) do
      nil ->
        {:error, :not_found}

      seed ->
        attrs =
          [
            {"name", params["name"]},
            {"prompt_template", params["prompt_template"]},
            {"schedule", params["schedule"]},
            {"active", params["active"]},
            {"context_injection", params["context_injection"]},
            {"metadata", params["metadata"]}
          ]
          |> Enum.reject(fn {_k, v} -> is_nil(v) end)
          |> Map.new(fn {k, v} -> {String.to_existing_atom(k), v} end)

        with {:ok, updated} <- Proposals.update_seed(seed, attrs) do
          json(conn, serialize_seed(updated))
        end
    end
  end

  def delete(conn, %{"id" => id}) do
    case Proposals.get_seed(id) do
      nil ->
        {:error, :not_found}

      seed ->
        case Ema.Repo.delete(seed) do
          {:ok, _} -> json(conn, %{ok: true})
          {:error, changeset} -> {:error, changeset}
        end
    end
  end

  def toggle(conn, %{"id" => id}) do
    with {:ok, seed} <- Proposals.toggle_seed(id) do
      json(conn, serialize_seed(seed))
    end
  end

  def run_now(conn, %{"id" => id}) do
    case Proposals.get_seed(id) do
      nil ->
        {:error, :not_found}

      seed ->
        Ema.ProposalEngine.Scheduler.run_seed(seed.id)
        json(conn, %{ok: true, seed_id: seed.id})
    end
  end

  defp serialize_seed(seed) do
    %{
      id: seed.id,
      name: seed.name,
      prompt_template: seed.prompt_template,
      seed_type: seed.seed_type,
      schedule: seed.schedule,
      active: seed.active,
      last_run_at: seed.last_run_at,
      run_count: seed.run_count,
      context_injection: seed.context_injection,
      metadata: seed.metadata,
      project_id: seed.project_id,
      created_at: seed.inserted_at,
      updated_at: seed.updated_at
    }
  end

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)

  defp parse_bool(nil), do: nil
  defp parse_bool("true"), do: true
  defp parse_bool("false"), do: false
  defp parse_bool(val) when is_boolean(val), do: val
  defp parse_bool(_), do: nil
end
