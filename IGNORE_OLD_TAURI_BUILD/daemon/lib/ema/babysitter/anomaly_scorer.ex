defmodule Ema.Babysitter.AnomalyScorer do
  alias Ema.Babysitter.{ChannelTopology, PatternMatcher}
  require Logger

  @alerts_channel "1484031239680823316"
  @dispatch_state_key {__MODULE__, :dispatch_state}
  @live_repeat_cooldown_ms 120_000
  @alert_repeat_cooldown_ms 600_000

  def score_and_dispatch(events, session_snapshot) do
    patterns = PatternMatcher.analyze(events, session_snapshot)
    score = aggregate_score(patterns)

    cond do
      score >= 0.7 ->
        maybe_post_alert(patterns, score)
        maybe_post_to_live(patterns, score, :critical)

      score >= 0.4 ->
        maybe_post_to_live(patterns, score, :warning)

      true ->
        :silent
    end

    score
  end

  defp aggregate_score([]), do: 0.0

  defp aggregate_score(patterns) do
    patterns
    |> Enum.map(& &1.severity)
    |> Enum.reduce(0.0, fn s, acc -> acc + s * (1.0 - acc) end)
    |> Float.round(3)
  end

  defp maybe_post_alert(patterns, score) do
    top = List.first(patterns)
    fingerprint = fingerprint(patterns)

    with true <- should_dispatch?(:alert, fingerprint, :critical) do
      msg =
        "🚨 **ANOMALY** · score #{Float.round(score, 2)}\n" <>
          "**Pattern:** `#{top.pattern}` · #{top.detail}\n" <>
          "**Action:** #{top.recommended_action}"

      Phoenix.PubSub.broadcast(Ema.PubSub, "discord:outbound:#{@alerts_channel}", {:post, msg})
      remember_dispatch(:alert, fingerprint, :critical)
    end
  end

  defp maybe_post_to_live(patterns, score, level) do
    fingerprint = fingerprint(patterns)

    with true <- should_dispatch?(:live, fingerprint, level) do
      channel_id = ChannelTopology.live_stream().channel_id
      icon = if level == :critical, do: "🔴", else: "🟡"

      lines =
        Enum.map(patterns, fn p -> "  #{sev_icon(p.severity)} `#{p.pattern}` #{p.detail}" end)

      msg = "#{icon} **anomaly score #{Float.round(score, 2)}**\n" <> Enum.join(lines, "\n")
      Phoenix.PubSub.broadcast(Ema.PubSub, "discord:outbound:#{channel_id}", {:post, msg})
      remember_dispatch(:live, fingerprint, level)
    end
  end

  defp should_dispatch?(stream, fingerprint, level) do
    now_ms = System.monotonic_time(:millisecond)
    state = :persistent_term.get(@dispatch_state_key, %{})

    case Map.get(state, stream) do
      nil ->
        true

      %{fingerprint: ^fingerprint, level: prev_level, at_ms: at_ms} ->
        level_rank(level) > level_rank(prev_level) or now_ms - at_ms >= cooldown_ms(stream)

      %{fingerprint: _other, level: _prev_level, at_ms: _at_ms} ->
        true
    end
  end

  defp remember_dispatch(stream, fingerprint, level) do
    now_ms = System.monotonic_time(:millisecond)
    state = :persistent_term.get(@dispatch_state_key, %{})
    updated = Map.put(state, stream, %{fingerprint: fingerprint, level: level, at_ms: now_ms})
    :persistent_term.put(@dispatch_state_key, updated)
  end

  defp fingerprint(patterns) do
    Enum.map(patterns, fn p ->
      {p.pattern, Float.round(p.severity, 3), p.detail, p.recommended_action,
       Enum.sort(p.affected || [])}
    end)
  end

  defp cooldown_ms(:alert), do: @alert_repeat_cooldown_ms
  defp cooldown_ms(:live), do: @live_repeat_cooldown_ms

  defp level_rank(:warning), do: 1
  defp level_rank(:critical), do: 2
  defp level_rank(_), do: 0

  defp sev_icon(s) when s >= 0.7, do: "🔴"
  defp sev_icon(s) when s >= 0.4, do: "🟡"
  defp sev_icon(_), do: "🟢"
end
