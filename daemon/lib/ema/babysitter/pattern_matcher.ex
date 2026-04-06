defmodule Ema.Babysitter.PatternMatcher do
  @moduledoc "Pure-function pattern engine. No side effects."

  def analyze(events, session_snapshot) do
    [
      detect_cascade_failure(events),
      detect_stalled_sessions(session_snapshot),
      detect_repeated_tool_failure(events),
      detect_build_spike(events),
      detect_quiet_anomaly(events)
    ]
    |> List.flatten()
    |> Enum.reject(&is_nil/1)
    |> Enum.sort_by(& &1.severity, :desc)
  end

  defp detect_cascade_failure(events) do
    window = recent_events(events, 300)
    failures = Enum.filter(window, &failure_event?/1)

    if length(failures) >= 3 do
      %{
        pattern: :cascade_failure,
        severity: min(1.0, length(failures) / 5.0),
        affected: Enum.map(failures, &event_source/1) |> Enum.uniq(),
        recommended_action: :alert_human,
        detail: "#{length(failures)} failures in 5 min"
      }
    end
  end

  defp detect_stalled_sessions(%{stalled: stalled})
       when is_list(stalled) and length(stalled) > 0 do
    unique =
      stalled
      |> Enum.map(fn s ->
        %{
          id: s.session_id || s.path || s.project_path || "unknown",
          path: s.project_path || "unknown",
          last_tool: s.last_tool || "none"
        }
      end)
      |> Enum.uniq_by(& &1.id)
      |> Enum.sort_by(& &1.path)

    sample =
      unique
      |> Enum.take(3)
      |> Enum.map_join(", ", fn s -> "#{s.path} (#{s.last_tool})" end)

    [
      %{
        pattern: :session_stall,
        severity: min(1.0, 0.45 + length(unique) * 0.1),
        affected: Enum.map(unique, & &1.id),
        recommended_action: :alert_human,
        detail: "#{length(unique)} stalled sessions: #{sample}"
      }
    ]
  end

  defp detect_stalled_sessions(_), do: []

  defp detect_repeated_tool_failure(events) do
    window = recent_events(events, 600)
    tool_failures = Enum.filter(window, &tool_failure_event?/1)

    if length(tool_failures) >= 3 do
      %{
        pattern: :repeated_tool_failure,
        severity: 0.6,
        affected: [],
        recommended_action: :alert_human,
        detail: "#{length(tool_failures)} tool failures in 10 min"
      }
    end
  end

  defp detect_build_spike(events) do
    window = recent_events(events, 120)
    builds = Enum.count(window, fn e -> e.category == :build end)

    if builds >= 8 do
      %{
        pattern: :build_spike,
        severity: 0.4,
        affected: [],
        recommended_action: :monitor,
        detail: "#{builds} build events in 2 min"
      }
    end
  end

  defp detect_quiet_anomaly(events) do
    if length(events) > 0 do
      now_s = System.os_time(:second)
      newest = events |> Enum.map(& &1.inserted_at) |> Enum.max(fn -> nil end)

      if newest do
        gap = now_s - DateTime.to_unix(newest)

        if gap > 600 do
          %{
            pattern: :quiet_anomaly,
            severity: 0.3,
            affected: [],
            recommended_action: :monitor,
            detail: "No events for #{div(gap, 60)}m"
          }
        end
      end
    end
  end

  defp recent_events(events, seconds_ago) do
    cutoff = System.os_time(:second) - seconds_ago

    Enum.filter(events, fn
      %{inserted_at: %DateTime{} = dt} -> DateTime.to_unix(dt) >= cutoff
      _ -> true
    end)
  end

  defp failure_event?(%{event: {tag, _}}) when tag in [:error, :failed, :crash], do: true

  defp failure_event?(%{event: ev}) when is_map(ev) do
    Map.get(ev, :status) in ["failed", "error"] or Map.get(ev, "status") in ["failed", "error"]
  end

  defp failure_event?(_), do: false

  defp tool_failure_event?(%{category: :sessions, event: {_tag, payload}}) when is_map(payload) do
    Map.get(payload, :tool_error) || Map.get(payload, "tool_error")
  end

  defp tool_failure_event?(_), do: false

  defp event_source(%{event: {_tag, %{id: id}}}), do: id
  defp event_source(%{event: {_tag, %{"id" => id}}}), do: id
  defp event_source(%{topic: topic}), do: topic
  defp event_source(_), do: "unknown"
end
