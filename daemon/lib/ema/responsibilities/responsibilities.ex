defmodule Ema.Responsibilities do
  @moduledoc """
  Responsibilities -- recurring areas of ownership. Each responsibility has a cadence,
  health status, and generates tasks when due. Supports check-ins for health tracking.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Responsibilities.{Responsibility, CheckIn}

  # --- List / Query ---

  def list_responsibilities(opts \\ []) do
    Responsibility
    |> maybe_filter_project(opts[:project_id])
    |> maybe_filter_role(opts[:role])
    |> maybe_filter_active(opts[:active])
    |> order_by(asc: :title)
    |> Repo.all()
  end

  def list_by_role(role) when is_binary(role) do
    Responsibility
    |> where([r], r.role == ^role)
    |> order_by(asc: :title)
    |> Repo.all()
  end

  def list_by_role do
    Responsibility
    |> order_by(asc: :role, asc: :title)
    |> Repo.all()
    |> Enum.group_by(& &1.role)
  end

  def list_at_risk do
    Responsibility
    |> where([r], r.health < 0.7 and r.active == true)
    |> order_by(asc: :title)
    |> Repo.all()
  end

  # --- Get ---

  def get_responsibility(id), do: Repo.get(Responsibility, id)

  def get_responsibility!(id), do: Repo.get!(Responsibility, id)

  # --- Create / Update / Delete ---

  def create_responsibility(attrs) do
    id = generate_id()

    %Responsibility{}
    |> Responsibility.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def update_responsibility(%Responsibility{} = resp, attrs) do
    resp
    |> Responsibility.changeset(attrs)
    |> Repo.update()
  end

  def delete_responsibility(%Responsibility{} = resp) do
    Repo.delete(resp)
  end

  def toggle_responsibility(%Responsibility{} = resp) do
    resp
    |> Responsibility.changeset(%{active: !resp.active})
    |> Repo.update()
  end

  # --- Check-ins ---

  def check_in(%Responsibility{} = resp, attrs) do
    check_in_id = generate_check_in_id()

    check_in_attrs =
      attrs
      |> Map.put(:id, check_in_id)
      |> Map.put(:responsibility_id, resp.id)

    Repo.transaction(fn ->
      case %CheckIn{} |> CheckIn.changeset(check_in_attrs) |> Repo.insert() do
        {:ok, check_in} ->
          health_score = check_in_status_to_health(check_in.status)

          case resp
               |> Responsibility.changeset(%{
                 health: health_score,
                 last_checked_at: DateTime.utc_now() |> DateTime.truncate(:second)
               })
               |> Repo.update() do
            {:ok, updated_resp} ->
              {updated_resp, check_in}

            {:error, changeset} ->
              Repo.rollback(changeset)
          end

        {:error, changeset} ->
          Repo.rollback(changeset)
      end
    end)
  end

  def list_check_ins(responsibility_id) do
    CheckIn
    |> where([c], c.responsibility_id == ^responsibility_id)
    |> order_by(desc: :inserted_at, desc: :id)
    |> Repo.all()
  end

  # --- Health ---

  def recalculate_health(%Responsibility{} = resp) do
    resp = Repo.preload(resp, :tasks)

    health_status = calculate_health_from_tasks(resp.tasks)

    resp
    |> Responsibility.changeset(%{health: health_status})
    |> Repo.update()
  end

  # --- Task Generation ---

  def generate_due_tasks do
    Responsibility
    |> where([r], r.active == true)
    |> where([r], not is_nil(r.cadence))
    |> where([r], r.cadence != "ongoing")
    |> Repo.all()
    |> Enum.filter(&cadence_due?/1)
    |> Enum.map(&create_task_for_responsibility/1)
  end

  # --- Private ---

  defp maybe_filter_project(query, nil), do: query

  defp maybe_filter_project(query, project_id) do
    where(query, [r], r.project_id == ^project_id)
  end

  defp maybe_filter_role(query, nil), do: query

  defp maybe_filter_role(query, role) do
    where(query, [r], r.role == ^role)
  end

  defp maybe_filter_active(query, nil), do: query

  defp maybe_filter_active(query, active) do
    where(query, [r], r.active == ^active)
  end

  defp calculate_health_from_tasks([]), do: 1.0

  defp calculate_health_from_tasks(tasks) do
    total = length(tasks)
    done = Enum.count(tasks, &(&1.status in ["done", "archived"]))
    overdue = Enum.count(tasks, &task_overdue?/1)

    completion_rate = done / total
    overdue_penalty = min(overdue * 0.15, 0.5)

    (completion_rate - overdue_penalty)
    |> max(0.0)
    |> min(1.0)
    |> Float.round(2)
  end

  defp check_in_status_to_health("healthy"), do: 1.0
  defp check_in_status_to_health("at_risk"), do: 0.5
  defp check_in_status_to_health("failing"), do: 0.2
  defp check_in_status_to_health(_), do: 0.5

  defp task_overdue?(%{due_date: nil}), do: false

  defp task_overdue?(%{due_date: _due_date, status: status}) when status in ["done", "archived", "cancelled"],
    do: false

  defp task_overdue?(%{due_date: due_date}) do
    Date.compare(due_date, Date.utc_today()) == :lt
  end

  defp cadence_due?(%Responsibility{last_checked_at: nil}), do: true

  defp cadence_due?(%Responsibility{cadence: cadence, last_checked_at: last}) do
    days_since = DateTime.diff(DateTime.utc_now(), last, :day)

    case cadence do
      "daily" -> days_since >= 1
      "weekly" -> days_since >= 7
      "biweekly" -> days_since >= 14
      "monthly" -> days_since >= 30
      "quarterly" -> days_since >= 90
      _ -> false
    end
  end

  defp create_task_for_responsibility(%Responsibility{} = resp) do
    Ema.Tasks.create_task(%{
      title: "#{resp.title} — recurring check",
      description: "Auto-generated task for responsibility: #{resp.title}",
      source_type: "responsibility",
      source_id: resp.id,
      responsibility_id: resp.id,
      project_id: resp.project_id,
      status: "todo"
    })
  end

  defp generate_id do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "resp_#{timestamp}_#{random}"
  end

  defp generate_check_in_id do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "rci_#{timestamp}_#{random}"
  end
end
