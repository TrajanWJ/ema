defmodule Ema.Harvesters do
  @moduledoc "Context module for harvester runs and shared utilities."

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Harvesters.Run

  def list_runs(opts \\ []) do
    Run
    |> maybe_filter(:harvester, opts[:harvester])
    |> order_by(desc: :started_at)
    |> limit(^Keyword.get(opts, :limit, 50))
    |> Repo.all()
  end

  def latest_run(harvester) do
    Run
    |> where([r], r.harvester == ^harvester)
    |> order_by(desc: :started_at)
    |> limit(1)
    |> Repo.one()
  end

  def start_run(harvester) do
    id = generate_id(harvester)
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    %Run{}
    |> Run.changeset(%{
      id: id,
      harvester: harvester,
      status: "running",
      started_at: now
    })
    |> Repo.insert()
  end

  def complete_run(run, attrs) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    run
    |> Run.changeset(Map.merge(attrs, %{completed_at: now}))
    |> Repo.update()
  end

  def generate_id(prefix) do
    ts = System.system_time(:millisecond) |> Integer.to_string()
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "hr_#{prefix}_#{ts}_#{rand}"
  end

  defp maybe_filter(query, _field, nil), do: query
  defp maybe_filter(query, field, value), do: where(query, [r], field(r, ^field) == ^value)
end
