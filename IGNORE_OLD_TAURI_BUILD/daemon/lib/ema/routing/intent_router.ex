defmodule Ema.Routing.IntentRouter do
  @moduledoc """
  Classify a task description into an intent type and recommended agent.
  Uses keyword/pattern matching first, falls back to heuristics.
  """

  @doc """
  Classify a task description into an intent type and recommended agent.
  """
  def classify(description) when is_binary(description) do
    lower = String.downcase(description)

    cond do
      matches_research?(lower) -> %{intent: :research, agent: "researcher", confidence: :high}
      matches_build?(lower) -> %{intent: :build, agent: "coder", confidence: :high}
      matches_organize?(lower) -> %{intent: :organize, agent: "vault-keeper", confidence: :high}
      matches_review?(lower) -> %{intent: :review, agent: "devils-advocate", confidence: :high}
      matches_security?(lower) -> %{intent: :security, agent: "security", confidence: :high}
      matches_ops?(lower) -> %{intent: :ops, agent: "ops", confidence: :high}
      true -> %{intent: :general, agent: "coder", confidence: :low}
    end
  end

  def classify(_), do: %{intent: :general, agent: "coder", confidence: :low}

  # Research: investigate, research, compare, analyze, study, explore, survey, benchmark, evaluate, assess
  defp matches_research?(text) do
    Enum.any?(
      ~w[research investigate compare analyze study explore survey benchmark evaluate assess],
      &String.contains?(text, &1)
    )
  end

  # Build: create, build, implement, make, add, fix, write, develop, generate, code, feature, endpoint, component, function, module
  defp matches_build?(text) do
    Enum.any?(
      ~w[create build implement make add fix write develop generate code feature endpoint component function module],
      &String.contains?(text, &1)
    )
  end

  # Organize: organize, sort, archive, vault, notes, structure, consolidate, tidy, curate
  defp matches_organize?(text) do
    Enum.any?(
      ~w[organize sort archive vault notes structure consolidate tidy curate],
      &String.contains?(text, &1)
    )
  end

  # Review: review, audit, check, critique, feedback, quality, improve, refine
  defp matches_review?(text) do
    Enum.any?(
      ~w[review audit check critique feedback quality improve refine],
      &String.contains?(text, &1)
    )
  end

  # Security: secure, security, vulnerability, auth, permission, exploit, harden, attack, threat
  defp matches_security?(text) do
    Enum.any?(
      ~w[secure security vulnerability auth permission exploit harden attack threat],
      &String.contains?(text, &1)
    )
  end

  # Ops: deploy, restart, monitor, health, cron, service, infra, server, uptime
  defp matches_ops?(text) do
    Enum.any?(
      ~w[deploy restart monitor health cron service infra server uptime],
      &String.contains?(text, &1)
    )
  end

  @doc """
  Route a task — classify and return routing decision with explanation.
  """
  def route(task) do
    description = Map.get(task, :description) || Map.get(task, "description") || ""
    classification = classify(description)

    %{
      task_id: Map.get(task, :id) || Map.get(task, "id"),
      intent: classification.intent,
      recommended_agent: classification.agent,
      confidence: classification.confidence,
      reasoning: explain(classification)
    }
  end

  defp explain(%{intent: intent, confidence: :high}) do
    "Classified as #{intent} based on keyword match"
  end

  defp explain(%{intent: :general, confidence: :low}) do
    "No strong keyword match — defaulting to coder agent"
  end
end
