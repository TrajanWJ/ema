defmodule EmaWeb.TemporalController do
  use EmaWeb, :controller

  alias Ema.Temporal

  action_fallback EmaWeb.FallbackController

  def rhythm(conn, _params) do
    rhythms = Temporal.list_rhythms() |> Enum.map(&serialize_rhythm/1)
    json(conn, %{rhythms: rhythms, slots: 168})
  end

  def now(conn, _params) do
    context = Temporal.current_context()

    json(conn, %{
      context: %{
        time_of_day: context.time_of_day,
        day_of_week: context.day_of_week,
        hour: context.hour,
        estimated_energy: context.estimated_energy,
        estimated_focus: context.estimated_focus,
        preferred_task_types: context.preferred_task_types,
        suggested_mode: context.suggested_mode,
        confidence: context.confidence,
        timestamp: context.timestamp
      }
    })
  end

  def best_time(conn, %{"for" => task_type}) do
    slots = Temporal.best_time_for(task_type)
    json(conn, %{task_type: task_type, slots: slots})
  end

  def best_time(conn, _params) do
    json(conn |> put_status(:bad_request), %{error: "missing 'for' parameter"})
  end

  def log(conn, params) do
    attrs = %{
      energy_level: parse_float(params["energy_level"]),
      focus_quality: parse_float(params["focus_quality"]),
      activity_type: params["activity_type"],
      source: params["source"] || "manual"
    }

    with {:ok, entry} <- Temporal.log_energy(attrs) do
      now = DateTime.utc_now()
      day = Date.day_of_week(now) - 1
      hour = now.hour

      if attrs.energy_level do
        Temporal.update_rhythm_from_signal(
          day,
          hour,
          attrs.energy_level,
          attrs.focus_quality || 5.0,
          attrs.activity_type
        )
      end

      conn
      |> put_status(:created)
      |> json(serialize_log(entry))
    end
  end

  def history(conn, params) do
    limit = safe_integer(params["limit"], 50)
    logs = Temporal.recent_logs(limit) |> Enum.map(&serialize_log/1)
    json(conn, %{logs: logs})
  end

  defp safe_integer(nil, default), do: default
  defp safe_integer(val, _default) when is_integer(val), do: val

  defp safe_integer(val, default) when is_binary(val) do
    case Integer.parse(val) do
      {n, ""} -> n
      _ -> default
    end
  end

  defp safe_integer(_, default), do: default

  defp parse_float(nil), do: nil
  defp parse_float(val) when is_float(val), do: val
  defp parse_float(val) when is_integer(val), do: val / 1.0

  defp parse_float(val) when is_binary(val) do
    case Float.parse(val) do
      {f, _} -> f
      :error -> nil
    end
  end

  defp serialize_rhythm(rhythm) do
    %{
      id: rhythm.id,
      day_of_week: rhythm.day_of_week,
      hour: rhythm.hour,
      energy_level: rhythm.energy_level,
      focus_quality: rhythm.focus_quality,
      preferred_task_types: rhythm.preferred_task_types,
      sample_count: rhythm.sample_count,
      updated_at: rhythm.updated_at
    }
  end

  defp serialize_log(log) do
    %{
      id: log.id,
      energy_level: log.energy_level,
      focus_quality: log.focus_quality,
      activity_type: log.activity_type,
      source: log.source,
      logged_at: log.logged_at,
      created_at: log.inserted_at
    }
  end
end
