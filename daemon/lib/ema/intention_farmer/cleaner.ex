defmodule Ema.IntentionFarmer.Cleaner do
  @moduledoc "Dedup, empty removal, split-session merge, and quality scoring for harvested sessions."

  @merge_window_seconds 600

  @doc """
  Run the full cleaning pipeline on a list of parsed results.
  Returns a map with :sessions, :empties, and :duplicates.
  """
  def clean(parsed_results) do
    results = attach_fingerprints(parsed_results)
    {kept, empties} = remove_empty(results)
    {unique, duplicates} = deduplicate(kept)
    merged = merge_split_sessions(unique)
    scored = score_quality(merged)

    %{
      sessions: scored,
      empties: empties,
      duplicates: duplicates
    }
  end

  @doc "Generate SHA256 fingerprint for session dedup."
  def source_fingerprint(source_type, session_id, raw_path) do
    data = "#{source_type}:#{session_id}:#{raw_path}"
    :crypto.hash(:sha256, data) |> Base.encode16(case: :lower)
  end

  @doc "Generate fingerprint for an intent."
  def intent_fingerprint(content, source_type, session_id) do
    data = "#{source_type}:#{session_id}:#{String.slice(content || "", 0..200)}"
    :crypto.hash(:sha256, data) |> Base.encode16(case: :lower)
  end

  # --- Private ---

  defp attach_fingerprints(results) do
    Enum.map(results, fn result ->
      fp = source_fingerprint(
        to_string(result.source_type),
        to_string(result.session_id),
        to_string(result[:raw_path])
      )

      intents =
        (result[:intents] || [])
        |> Enum.map(fn intent ->
          ifp = intent_fingerprint(
            intent.content,
            to_string(intent.source_type),
            to_string(result.session_id)
          )

          Map.put(intent, :source_fingerprint, ifp)
        end)

      result
      |> Map.put(:source_fingerprint, fp)
      |> Map.put(:intents, intents)
    end)
  end

  defp remove_empty(results) do
    {empties, kept} =
      Enum.split_with(results, fn result ->
        message_count = result[:message_count] || 0
        intent_count = length(result[:intents] || [])
        tool_call_count = result[:tool_call_count] || 0

        message_count == 0 and intent_count == 0 and tool_call_count == 0
      end)

    empties = Enum.map(empties, &Map.put(&1, :status, "empty"))
    {kept, empties}
  end

  defp deduplicate(results) do
    grouped = Enum.group_by(results, & &1.source_fingerprint)

    {unique, duplicates} =
      Enum.reduce(grouped, {[], []}, fn {_fp, group}, {uniq_acc, dup_acc} ->
        sorted = Enum.sort_by(group, &(&1[:message_count] || 0), :desc)
        [best | rest] = sorted
        dupes = Enum.map(rest, &Map.put(&1, :status, "duplicate"))
        {[best | uniq_acc], dupes ++ dup_acc}
      end)

    {Enum.reverse(unique), duplicates}
  end

  defp merge_split_sessions(results) do
    results
    |> Enum.group_by(fn r -> {r.source_type, r[:project_path]} end)
    |> Enum.flat_map(fn {_key, group} -> merge_group(group) end)
  end

  defp merge_group(sessions) do
    sessions
    |> Enum.sort_by(&session_start_time/1)
    |> do_merge([])
  end

  defp do_merge([], acc), do: Enum.reverse(acc)
  defp do_merge([session], acc), do: Enum.reverse([session | acc])

  defp do_merge([a, b | rest], acc) do
    if within_merge_window?(a, b) do
      merged = merge_two(a, b)
      do_merge([merged | rest], acc)
    else
      do_merge([b | rest], [a | acc])
    end
  end

  defp within_merge_window?(a, b) do
    a_end = a[:ended_at]
    b_start = b[:started_at]

    case {a_end, b_start} do
      {nil, _} -> false
      {_, nil} -> false
      {a_end, b_start} ->
        diff = abs(DateTime.diff(b_start, a_end, :second))
        diff <= @merge_window_seconds
    end
  end

  defp merge_two(a, b) do
    %{
      session_id: a.session_id,
      source_type: a.source_type,
      raw_path: a[:raw_path],
      project_path: a[:project_path],
      model: a[:model] || b[:model],
      model_provider: a[:model_provider] || b[:model_provider],
      started_at: earliest(a[:started_at], b[:started_at]),
      ended_at: latest(a[:ended_at], b[:ended_at]),
      message_count: (a[:message_count] || 0) + (b[:message_count] || 0),
      tool_call_count: (a[:tool_call_count] || 0) + (b[:tool_call_count] || 0),
      token_count: (a[:token_count] || 0) + (b[:token_count] || 0),
      files_touched: Enum.uniq((a[:files_touched] || []) ++ (b[:files_touched] || [])),
      intents: (a[:intents] || []) ++ (b[:intents] || []),
      source_fingerprint: a.source_fingerprint,
      metadata: Map.merge(a[:metadata] || %{}, b[:metadata] || %{}, fn _k, v1, _v2 -> v1 end)
    }
  end

  defp session_start_time(session) do
    case session[:started_at] do
      %DateTime{} = dt -> DateTime.to_unix(dt)
      _ -> 0
    end
  end

  defp earliest(nil, b), do: b
  defp earliest(a, nil), do: a
  defp earliest(a, b), do: if(DateTime.compare(a, b) == :lt, do: a, else: b)

  defp latest(nil, b), do: b
  defp latest(a, nil), do: a
  defp latest(a, b), do: if(DateTime.compare(a, b) == :gt, do: a, else: b)

  defp score_quality(results) do
    Enum.map(results, fn result ->
      score = compute_score(result)
      Map.put(result, :quality_score, score)
    end)
  end

  defp compute_score(result) do
    msg = message_score(result[:message_count] || 0)
    tool = tool_score(result[:tool_call_count] || 0)
    intent = if length(result[:intents] || []) > 0, do: 0.2, else: 0.0
    files = if length(result[:files_touched] || []) > 0, do: 0.1, else: 0.0
    tokens = if (result[:token_count] || 0) > 1000, do: 0.1, else: 0.0

    Float.round(msg + tool + intent + files + tokens, 2)
  end

  defp message_score(0), do: 0.0
  defp message_score(n) when n >= 1 and n <= 5, do: 0.2
  defp message_score(n) when n >= 6 and n <= 20, do: 0.5
  defp message_score(_), do: 0.3

  defp tool_score(0), do: 0.0
  defp tool_score(n) when n >= 1 and n <= 10, do: 0.2
  defp tool_score(_), do: 0.1
end
