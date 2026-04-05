defmodule Ema.Harvesters.SessionHarvester do
  @moduledoc """
  Scans ~/.claude/projects/ JSONL session files for patterns.
  Creates proposal seeds based on recurring tool usage, long sessions, and error patterns.
  """

  use Ema.Harvesters.Base, name: "session", interval: :timer.hours(4)

  alias Ema.Proposals

  @session_root Path.expand("~/.claude/projects")

  @impl Ema.Harvesters.Base
  def harvester_name, do: "session"

  @impl Ema.Harvesters.Base
  def default_interval, do: :timer.hours(4)

  @impl Ema.Harvesters.Base
  def harvest(_context) do
    since = DateTime.utc_now() |> DateTime.add(-24 * 3600, :second)
    sessions = scan_recent_sessions(since)

    patterns = extract_patterns(sessions)
    seeds_created = create_pattern_seeds(patterns)

    {:ok, %{
      items_found: length(sessions),
      seeds_created: seeds_created,
      metadata: %{patterns_found: map_size(patterns)}
    }}
  rescue
    e -> {:error, Exception.message(e)}
  end

  defp scan_recent_sessions(since) do
    case File.ls(@session_root) do
      {:ok, dirs} ->
        dirs
        |> Enum.flat_map(&find_jsonl_files(Path.join(@session_root, &1)))
        |> Enum.filter(&modified_since?(&1, since))
        |> Enum.flat_map(&parse_session_file/1)

      {:error, _} -> []
    end
  end

  defp find_jsonl_files(dir) do
    case File.ls(dir) do
      {:ok, files} ->
        files
        |> Enum.filter(&String.ends_with?(&1, ".jsonl"))
        |> Enum.map(&Path.join(dir, &1))

      {:error, _} -> []
    end
  end

  defp modified_since?(path, since) do
    case File.stat(path, time: :posix) do
      {:ok, %{mtime: mtime}} ->
        file_time = DateTime.from_unix!(mtime)
        DateTime.compare(file_time, since) != :lt

      _ -> false
    end
  end

  defp parse_session_file(path) do
    path
    |> File.stream!()
    |> Stream.map(&parse_jsonl_line/1)
    |> Stream.reject(&is_nil/1)
    |> Enum.to_list()
  rescue
    _ -> []
  end

  defp parse_jsonl_line(line) do
    case Jason.decode(String.trim(line)) do
      {:ok, data} -> data
      {:error, _} -> nil
    end
  end

  defp extract_patterns(events) do
    %{}
    |> maybe_add_pattern(:frequent_tools, extract_tool_frequency(events))
    |> maybe_add_pattern(:error_patterns, extract_error_patterns(events))
    |> maybe_add_pattern(:long_sessions, extract_long_sessions(events))
  end

  defp extract_tool_frequency(events) do
    tool_counts =
      events
      |> Enum.filter(&match?(%{"type" => "tool_use"}, &1))
      |> Enum.frequencies_by(&(&1["name"] || &1["tool"] || "unknown"))
      |> Enum.sort_by(fn {_, count} -> count end, :desc)
      |> Enum.take(5)

    if length(tool_counts) > 0, do: tool_counts, else: nil
  end

  defp extract_error_patterns(events) do
    errors =
      events
      |> Enum.filter(fn e ->
        type = e["type"] || ""
        String.contains?(type, "error") or Map.has_key?(e, "error")
      end)

    if length(errors) >= 3, do: length(errors), else: nil
  end

  defp extract_long_sessions(events) do
    # Sessions with >100 events suggest complex multi-step work
    if length(events) > 100, do: length(events), else: nil
  end

  defp maybe_add_pattern(map, _key, nil), do: map
  defp maybe_add_pattern(map, key, value), do: Map.put(map, key, value)

  defp create_pattern_seeds(patterns) when map_size(patterns) == 0, do: 0
  defp create_pattern_seeds(patterns) do
    seeds =
      patterns
      |> Enum.map(&create_seed_for_pattern/1)
      |> Enum.count(&(&1 == :ok))

    seeds
  end

  defp create_seed_for_pattern({:frequent_tools, tool_counts}) do
    tool_summary = Enum.map_join(tool_counts, "\n", fn {tool, count} -> "- #{tool}: #{count} uses" end)

    case Proposals.create_seed(%{
      name: "Session tool usage patterns",
      seed_type: "session",
      prompt_template: """
      Analysis of recent Claude Code sessions shows frequent tool usage:

      #{tool_summary}

      Propose workflow optimizations, custom tools, or automation to reduce repetitive tool usage.
      """,
      schedule: "every_8h",
      active: true,
      metadata: %{source: "session_harvester", tool_counts: Map.new(tool_counts)}
    }) do
      {:ok, _} -> :ok
      {:error, _} -> :error
    end
  end

  defp create_seed_for_pattern({:error_patterns, error_count}) do
    case Proposals.create_seed(%{
      name: "Session error patterns detected",
      seed_type: "session",
      prompt_template: """
      Recent Claude Code sessions had #{error_count} errors.
      Investigate recurring failure patterns and propose preventive measures or better error handling.
      """,
      schedule: "every_8h",
      active: true,
      metadata: %{source: "session_harvester", error_count: error_count}
    }) do
      {:ok, _} -> :ok
      {:error, _} -> :error
    end
  end

  defp create_seed_for_pattern({:long_sessions, event_count}) do
    case Proposals.create_seed(%{
      name: "Complex session detected",
      seed_type: "session",
      prompt_template: """
      A Claude Code session had #{event_count} events, suggesting complex multi-step work.
      Propose task decomposition strategies or workflow templates to handle similar tasks more efficiently.
      """,
      schedule: "every_8h",
      active: true,
      metadata: %{source: "session_harvester", event_count: event_count}
    }) do
      {:ok, _} -> :ok
      {:error, _} -> :error
    end
  end
end
