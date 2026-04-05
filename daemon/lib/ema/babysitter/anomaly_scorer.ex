defmodule Ema.Babysitter.AnomalyScorer do
  alias Ema.Babysitter.{ChannelTopology, PatternMatcher}
  require Logger

  @alerts_channel "1484031239680823316"

  def score_and_dispatch(events, session_snapshot) do
    patterns = PatternMatcher.analyze(events, session_snapshot)
    score = aggregate_score(patterns)
    cond do
      score >= 0.7 -> post_alert(patterns, score); post_to_live(patterns, score, :critical)
      score >= 0.4 -> post_to_live(patterns, score, :warning)
      true -> :silent
    end
    score
  end

  defp aggregate_score([]), do: 0.0
  defp aggregate_score(patterns) do
    patterns |> Enum.map(& &1.severity)
    |> Enum.reduce(0.0, fn s, acc -> acc + s * (1.0 - acc) end)
    |> Float.round(3)
  end

  defp post_alert(patterns, score) do
    top = List.first(patterns)
    msg = "🚨 **ANOMALY** · score #{Float.round(score, 2)}\n**Pattern:** `#{top.pattern}` · #{top.detail}\n**Action:** #{top.recommended_action}"
    Phoenix.PubSub.broadcast(Ema.PubSub, "discord:outbound:#{@alerts_channel}", {:post, msg})
  end

  defp post_to_live(patterns, score, level) do
    channel_id = ChannelTopology.live_stream().channel_id
    icon = if level == :critical, do: "🔴", else: "🟡"
    lines = Enum.map(patterns, fn p -> "  #{sev_icon(p.severity)} `#{p.pattern}` #{p.detail}" end)
    msg = "#{icon} **anomaly score #{Float.round(score, 2)}**\n" <> Enum.join(lines, "\n")
    Phoenix.PubSub.broadcast(Ema.PubSub, "discord:outbound:#{channel_id}", {:post, msg})
  end

  defp sev_icon(s) when s >= 0.7, do: "🔴"
  defp sev_icon(s) when s >= 0.4, do: "🟡"
  defp sev_icon(_), do: "🟢"
end
