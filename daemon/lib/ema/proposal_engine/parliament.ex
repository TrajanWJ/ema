defmodule Ema.ProposalEngine.Parliament do
  @moduledoc """
  Five perspectives in one LLM call. Replaces (or augments) the single-blob
  Debater with five purpose-built agencies whose verdicts are extracted from
  one structured response.

  Pattern source: OpenKoi research — "Parliament-in-One-Call".

  Each agency answers a single question from a single concern. The synthesis
  paragraph and confidence score are produced by the same call. If any agency
  REJECTs, `any_reject` is true so callers can short-circuit downstream
  approval flows.

  Wired into the proposal pipeline as an alternative to `Debater`. To enable,
  flip the `:debater_strategy` config flag (or call `deliberate/1` directly
  from a higher-level orchestrator).

  ## Usage

      iex> {:ok, result} = Parliament.deliberate(proposal)
      %{
        guardian: %{verdict: :approve, reasoning: "..."},
        economist: %{verdict: :approve, reasoning: "..."},
        empath: %{verdict: :approve, reasoning: "..."},
        scholar: %{verdict: :reject, reasoning: "..."},
        strategist: %{verdict: :approve, reasoning: "..."},
        synthesis: "...",
        confidence: 0.62,
        any_reject: true
      }
  """

  require Logger

  @agencies [
    {:guardian, "Is this safe? Can it be undone? What could go wrong?"},
    {:economist, "Is this worth the cost in time and tokens? What is the ROI?"},
    {:empath, "How will the user feel about this? Is the tone right?"},
    {:scholar, "Is this actually true and well-sourced? What is the evidence?"},
    {:strategist, "Does this serve the long-horizon trajectory? Strategic fit?"}
  ]

  @doc """
  Run a five-agency parliament on a proposal in a single Claude call.

  Returns `{:ok, deliberation_map}` or `{:error, reason}`.
  """
  def deliberate(proposal) do
    prompt = build_parliament_prompt(proposal)

    case Ema.Claude.AI.run(prompt, model: "haiku", max_tokens: 1500, stage: :debater) do
      {:ok, %{"result" => result}} when is_binary(result) ->
        {:ok, parse_deliberation(result)}

      {:ok, %{"raw" => raw}} when is_binary(raw) ->
        {:ok, parse_deliberation(raw)}

      {:ok, other} when is_map(other) ->
        # Bridge or alternate backend may return a different shape — try common keys.
        text =
          other["text"] || other["content"] || other["output"] || Jason.encode!(other)

        {:ok, parse_deliberation(text)}

      {:error, reason} = err ->
        Logger.warning("Parliament: deliberation failed: #{inspect(reason)}")
        err
    end
  end

  @doc "List of agency atoms in canonical order."
  def agencies, do: Enum.map(@agencies, fn {name, _} -> name end)

  # ── Prompt construction ───────────────────────────────────────────────────

  defp build_parliament_prompt(proposal) do
    agencies_text =
      Enum.map_join(@agencies, "\n", fn {name, question} ->
        "- #{String.upcase(to_string(name))}: #{question}"
      end)

    body = proposal.body || proposal.summary || ""

    """
    You are a council of 5 perspectives evaluating this proposal.

    Proposal: #{proposal.title}
    Body: #{body}

    Each agency must respond from its specific concern:
    #{agencies_text}

    Respond in this EXACT format (one line per agency, no extra commentary):
    GUARDIAN: APPROVE|REJECT | reasoning
    ECONOMIST: APPROVE|REJECT | reasoning
    EMPATH: APPROVE|REJECT | reasoning
    SCHOLAR: APPROVE|REJECT | reasoning
    STRATEGIST: APPROVE|REJECT | reasoning

    SYNTHESIS: One paragraph combining the perspectives.
    CONFIDENCE: 0.0-1.0
    """
  end

  # ── Parsing ───────────────────────────────────────────────────────────────

  defp parse_deliberation(text) when is_binary(text) do
    %{
      guardian: extract_verdict(text, "GUARDIAN"),
      economist: extract_verdict(text, "ECONOMIST"),
      empath: extract_verdict(text, "EMPATH"),
      scholar: extract_verdict(text, "SCHOLAR"),
      strategist: extract_verdict(text, "STRATEGIST"),
      synthesis: extract_section(text, "SYNTHESIS"),
      confidence: extract_confidence(text),
      any_reject: any_rejection?(text),
      raw: text
    }
  end

  defp parse_deliberation(_), do: empty_deliberation()

  defp empty_deliberation do
    %{
      guardian: %{verdict: :unknown, reasoning: ""},
      economist: %{verdict: :unknown, reasoning: ""},
      empath: %{verdict: :unknown, reasoning: ""},
      scholar: %{verdict: :unknown, reasoning: ""},
      strategist: %{verdict: :unknown, reasoning: ""},
      synthesis: "",
      confidence: nil,
      any_reject: false,
      raw: ""
    }
  end

  # Match `AGENCY: APPROVE|REJECT | reasoning` on its own line.
  defp extract_verdict(text, agency) do
    pattern = ~r/^\s*#{agency}\s*:\s*(APPROVE|REJECT)\s*\|\s*(.*)$/im

    case Regex.run(pattern, text) do
      [_, verdict, reasoning] ->
        %{
          verdict: normalize_verdict(verdict),
          reasoning: String.trim(reasoning)
        }

      _ ->
        %{verdict: :unknown, reasoning: ""}
    end
  end

  defp normalize_verdict(v) do
    case String.upcase(v) do
      "APPROVE" -> :approve
      "REJECT" -> :reject
      _ -> :unknown
    end
  end

  # SYNTHESIS may be a single line or wrap to next lines until CONFIDENCE.
  defp extract_section(text, "SYNTHESIS") do
    case Regex.run(~r/SYNTHESIS\s*:\s*(.*?)(?=\n\s*CONFIDENCE\s*:|\z)/is, text) do
      [_, body] -> String.trim(body)
      _ -> ""
    end
  end

  defp extract_confidence(text) do
    case Regex.run(~r/CONFIDENCE\s*:\s*([0-9]*\.?[0-9]+)/i, text) do
      [_, num] ->
        case Float.parse(num) do
          {f, _} -> f |> max(0.0) |> min(1.0)
          :error -> nil
        end

      _ ->
        nil
    end
  end

  defp any_rejection?(text) do
    Regex.match?(~r/^\s*(GUARDIAN|ECONOMIST|EMPATH|SCHOLAR|STRATEGIST)\s*:\s*REJECT/im, text)
  end
end
