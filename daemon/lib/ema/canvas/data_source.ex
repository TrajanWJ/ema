defmodule Ema.Canvas.DataSource do
  @moduledoc """
  Resolves data source identifiers to actual data for canvas chart elements.
  Each fetch/2 clause returns {:ok, data} or {:error, reason}.
  Data is always a list of maps suitable for charting.
  """

  alias Ema.Repo

  @sources %{
    "tasks:by_status" => "Task counts grouped by status",
    "tasks:by_project" => "Task counts grouped by project",
    "tasks:completed_over_time" => "Task completion trend (last N days)",
    "proposals:by_confidence" => "Proposal count by confidence buckets",
    "proposals:approval_rate" => "Approval/kill/redirect rates over time",
    "habits:completion_rate" => "Habit completion percentage over time",
    "responsibilities:health" => "Responsibility health scores",
    "sessions:token_usage" => "Token consumption over time",
    "vault:notes_by_space" => "Note counts per space",
    "custom:query" => "Custom read-only SQL query"
  }

  def available_sources, do: @sources

  def fetch("tasks:by_status", _config) do
    try do
      result =
        Repo.query!("SELECT status, COUNT(*) as count FROM tasks GROUP BY status")

      data =
        Enum.map(result.rows, fn [status, count] ->
          %{label: status, value: count}
        end)

      {:ok, data}
    rescue
      _ -> {:ok, []}
    end
  end

  def fetch("tasks:by_project", _config) do
    try do
      result =
        Repo.query!(
          "SELECT COALESCE(goal_id, 'unassigned') as project, COUNT(*) as count FROM tasks GROUP BY goal_id"
        )

      data =
        Enum.map(result.rows, fn [project, count] ->
          %{label: project, value: count}
        end)

      {:ok, data}
    rescue
      _ -> {:ok, []}
    end
  end

  def fetch("tasks:completed_over_time", config) do
    days = Map.get(config, "days", 30)

    try do
      result =
        Repo.query!(
          """
          SELECT date(updated_at) as day, COUNT(*) as count
          FROM tasks
          WHERE status = 'done'
            AND updated_at >= datetime('now', ?)
          GROUP BY date(updated_at)
          ORDER BY day
          """,
          ["-#{days} days"]
        )

      data =
        Enum.map(result.rows, fn [day, count] ->
          %{date: day, value: count}
        end)

      {:ok, data}
    rescue
      _ -> {:ok, []}
    end
  end

  def fetch("proposals:by_confidence", _config) do
    # Proposals context doesn't exist yet — return stub data
    {:ok, []}
  end

  def fetch("proposals:approval_rate", _config) do
    {:ok, []}
  end

  def fetch("habits:completion_rate", config) do
    days = Map.get(config, "days", 30)

    try do
      result =
        Repo.query!(
          """
          SELECT hl.date, COUNT(CASE WHEN hl.completed THEN 1 END) as completed,
                 COUNT(*) as total
          FROM habit_logs hl
          WHERE hl.date >= date('now', ?)
          GROUP BY hl.date
          ORDER BY hl.date
          """,
          ["-#{days} days"]
        )

      data =
        Enum.map(result.rows, fn [date, completed, total] ->
          rate = if total > 0, do: Float.round(completed / total * 100, 1), else: 0.0
          %{date: date, value: rate, completed: completed, total: total}
        end)

      {:ok, data}
    rescue
      _ -> {:ok, []}
    end
  end

  def fetch("responsibilities:health", _config) do
    {:ok, []}
  end

  def fetch("sessions:token_usage", _config) do
    {:ok, []}
  end

  def fetch("vault:notes_by_space", _config) do
    try do
      result =
        Repo.query!(
          "SELECT space, COUNT(*) as count FROM vault_index GROUP BY space"
        )

      data =
        Enum.map(result.rows, fn [space, count] ->
          %{label: space || "uncategorized", value: count}
        end)

      {:ok, data}
    rescue
      _ -> {:ok, []}
    end
  end

  def fetch("custom:query", config) do
    query = Map.get(config, "query", "")

    case validate_query(query) do
      :ok ->
        try do
          result = Repo.query!(query)

          data =
            Enum.map(result.rows, fn row ->
              result.columns
              |> Enum.zip(row)
              |> Map.new()
            end)

          {:ok, data}
        rescue
          e -> {:error, "Query failed: #{Exception.message(e)}"}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  def fetch(source, _config) do
    {:error, "Unknown data source: #{source}"}
  end

  @doc """
  Validates that a custom query is a safe read-only SELECT statement.
  """
  def validate_query(query) when is_binary(query) do
    normalized = query |> String.trim() |> String.upcase()

    cond do
      normalized == "" ->
        {:error, "Query cannot be empty"}

      not String.starts_with?(normalized, "SELECT") ->
        {:error, "Only SELECT statements are allowed"}

      Regex.match?(~r/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b/, normalized) ->
        {:error, "Query contains forbidden statements"}

      true ->
        :ok
    end
  end

  def validate_query(_), do: {:error, "Query must be a string"}
end
