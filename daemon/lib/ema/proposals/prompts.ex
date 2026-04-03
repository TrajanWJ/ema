defmodule Ema.Proposals.Prompts do
  @moduledoc """
  Stage-specific prompt templates for the Proposal Orchestrator pipeline.

  Each stage receives a structured context map and returns a formatted
  prompt string ready to be sent to the Bridge.

  ## Context Map Fields
    - `:seed`           — The proposal seed (has :prompt_template, :name)
    - `:project`        — Project context (has :name, :description, :path)
    - `:context`        — Additional enrichment (vault entries, goals, tasks, etc.)
    - `:prior_outputs`  — Map of %{stage_atom => output_string} from previous stages

  ## Variable Substitution
  Templates use `{{variable}}` placeholders filled from the context map.

  ## Stage Models
    - Generator  → haiku  (fast, cheap initial draft)
    - Refiner    → sonnet (balanced quality improvement)
    - RiskAnalyzer → sonnet (balanced risk analysis)
    - Formatter  → haiku  (cheap final formatting)
  """

  @doc """
  Build a prompt for the given pipeline stage.

  ## Parameters
    - `stage` — Atom: `:generator`, `:refiner`, `:risk_analyzer`, or `:formatter`
    - `context` — Map with :seed, :project, :context, :prior_outputs
  """
  def build(stage, context) when stage in [:generator, :refiner, :risk_analyzer, :formatter] do
    template = template_for(stage)
    vars = extract_vars(stage, context)
    substitute(template, vars)
  end

  def build(stage, _context) do
    raise ArgumentError, "Unknown proposal pipeline stage: #{inspect(stage)}"
  end

  # ── Templates ──────────────────────────────────────────────────────────────

  defp template_for(:generator) do
    """
    You are a senior software architect generating a detailed technical proposal.

    ## Seed Prompt
    {{seed_prompt}}

    ## Project Context
    {{project_context}}

    ## Additional Context
    {{additional_context}}

    ## Your Task
    Generate a comprehensive 3-section proposal with the following structure:

    # {{proposal_title_hint}}

    ## Summary
    [2-3 sentences describing the proposal's core idea and primary benefit]

    ## Proposal
    [Detailed description of the proposed change, feature, or improvement.
    Be specific. Include technical details where relevant.
    Describe the "what" and "why" clearly.]

    ## Next Steps
    [5-7 concrete, numbered, assignable action items]
    1. [Specific task]
    2. [Specific task]
    ...

    Focus on being concrete and actionable. Output the proposal as markdown.
    Do not add risks or scope sections yet — those come in later stages.
    """
  end

  defp template_for(:refiner) do
    """
    You are refining an initial proposal draft to improve its structure, clarity, and completeness.

    ## Original Draft
    {{generator_output}}

    ## Project Context
    {{project_context}}

    ## Refinement Instructions
    Improve this proposal by:

    1. **Strengthening the Summary** — Make it crisp, specific, and compelling
    2. **Expanding the Proposal body** — Add technical depth, examples, and rationale
    3. **Clarifying Next Steps** — Ensure each step is concrete and assignable to a specific role
    4. **Adding a Scope section** — Define explicitly what is in-scope and out-of-scope:
       ```
       ## Scope
       **In scope:** [list items]
       **Out of scope:** [list items]
       ```
    5. **Adding a Goal Alignment section** — Explain how this supports project objectives:
       ```
       ## Goal Alignment
       [2-3 sentences connecting this proposal to project goals]
       ```

    Keep the same core idea. Improve structure, not direction.
    Output the full refined proposal as markdown.
    """
  end

  defp template_for(:risk_analyzer) do
    """
    You are a risk analyst reviewing a technical proposal to identify risks and mitigation strategies.

    ## Refined Proposal
    {{refiner_output}}

    ## Project Context
    {{project_context}}

    ## Your Task
    Analyze this proposal and produce a risk analysis section.

    Write a **## Risks** section with at least 3 specific risks in this format:

    ## Risks

    - **[Risk Name]**: [Description of the risk and its potential impact]
      *Mitigation*: [Specific strategy to address or reduce this risk]

    - **[Risk Name]**: [Description of the risk and its potential impact]
      *Mitigation*: [Specific strategy to address or reduce this risk]

    - **[Risk Name]**: [Description of the risk and its potential impact]
      *Mitigation*: [Specific strategy to address or reduce this risk]

    Categories to consider:
    - Technical risks (complexity, dependencies, breaking changes)
    - Scope creep risks
    - Performance/scalability risks
    - Integration risks
    - Timeline risks

    Be specific. Generic risks like "might fail" are not acceptable.
    Name the risk, describe its impact, and provide a concrete mitigation.

    Also add a ## Benefits section listing 3-5 concrete benefits of implementing this proposal.
    """
  end

  defp template_for(:formatter) do
    """
    You are formatting a technical proposal into its final polished markdown form.

    ## Refined Proposal
    {{refiner_output}}

    ## Risk Analysis
    {{risk_output}}

    ## Formatting Instructions
    Combine and format everything into a single, well-structured proposal document:

    # [Title]

    ## Summary
    [2-3 sentence overview]

    ## Background & Motivation
    [Why this proposal exists]

    ## Proposal
    [Core content from the refined draft]

    ## Scope
    **In scope:**
    - [item]

    **Out of scope:**
    - [item]

    ## Risks
    [Risk analysis from the risk analyzer stage]

    ## Benefits
    [Benefits from the risk analysis stage]

    ## Goal Alignment
    [Connection to project objectives]

    ## Next Steps
    [Numbered, assignable action items]

    ## Formatting rules:
    - Use clean markdown with proper heading hierarchy
    - Keep bullet points concise (1-2 lines each)
    - Bold important terms
    - Ensure all 7 sections are present
    - Target length: 500-1000 words
    - Professional but readable tone

    Output ONLY the formatted proposal markdown. No preamble, no commentary.
    """
  end

  # ── Variable Extraction ────────────────────────────────────────────────────

  defp extract_vars(:generator, %{seed: seed, project: project, context: ctx}) do
    %{
      "seed_prompt" => seed_prompt(seed),
      "project_context" => project_context(project),
      "additional_context" => additional_context(ctx),
      "proposal_title_hint" => proposal_title_hint(seed)
    }
  end

  defp extract_vars(:refiner, %{seed: seed, project: project, prior_outputs: prior}) do
    %{
      "generator_output" => Map.get(prior, :generator, "[No generator output]"),
      "project_context" => project_context(project),
      "seed_name" => seed_name(seed)
    }
  end

  defp extract_vars(:risk_analyzer, %{project: project, prior_outputs: prior}) do
    %{
      "refiner_output" => Map.get(prior, :refiner, Map.get(prior, :generator, "[No prior output]")),
      "project_context" => project_context(project)
    }
  end

  defp extract_vars(:formatter, %{prior_outputs: prior}) do
    %{
      "refiner_output" => Map.get(prior, :refiner, Map.get(prior, :generator, "[No prior output]")),
      "risk_output" => Map.get(prior, :risk_analyzer, "[No risk analysis]")
    }
  end

  defp extract_vars(_, _), do: %{}

  # ── Template Substitution ──────────────────────────────────────────────────

  defp substitute(template, vars) do
    Enum.reduce(vars, template, fn {key, value}, acc ->
      String.replace(acc, "{{#{key}}}", to_string(value || ""))
    end)
  end

  # ── Context Builders ───────────────────────────────────────────────────────

  defp seed_prompt(%{prompt_template: pt}) when is_binary(pt) and byte_size(pt) > 0, do: pt
  defp seed_prompt(%{"prompt_template" => pt}) when is_binary(pt) and byte_size(pt) > 0, do: pt
  defp seed_prompt(%{name: name}), do: "Generate a proposal for: #{name}"
  defp seed_prompt(%{"name" => name}), do: "Generate a proposal for: #{name}"
  defp seed_prompt(_), do: "Generate a technical improvement proposal."

  defp seed_name(%{name: name}), do: name
  defp seed_name(%{"name" => name}), do: name
  defp seed_name(_), do: "proposal"

  defp proposal_title_hint(seed) do
    name = seed_name(seed)
    # Capitalize each word for a title-like hint
    name
    |> String.split(~r/[\s_\-]+/)
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end

  defp project_context(nil), do: "No specific project context provided."

  defp project_context(project) when is_map(project) do
    parts = []

    parts = if name = Map.get(project, :name) || Map.get(project, "name") do
      ["**Project:** #{name}" | parts]
    else
      parts
    end

    parts = if desc = Map.get(project, :description) || Map.get(project, "description") do
      ["**Description:** #{String.slice(desc, 0..200)}" | parts]
    else
      parts
    end

    parts = if path = Map.get(project, :path) || Map.get(project, "path") do
      ["**Path:** #{path}" | parts]
    else
      parts
    end

    case parts do
      [] -> "No specific project context provided."
      _ -> Enum.reverse(parts) |> Enum.join("\n")
    end
  end

  defp additional_context(nil), do: "No additional context."
  defp additional_context(ctx) when is_map(ctx) and map_size(ctx) == 0, do: "No additional context."

  defp additional_context(ctx) when is_map(ctx) do
    parts = []

    parts = if goals = Map.get(ctx, :goals) || Map.get(ctx, "goals") do
      formatted = format_list(goals, "Active Goals")
      [formatted | parts]
    else
      parts
    end

    parts = if vault = Map.get(ctx, :vault) || Map.get(ctx, "vault") do
      formatted = format_list(vault, "Relevant Vault Entries")
      [formatted | parts]
    else
      parts
    end

    parts = if tasks = Map.get(ctx, :tasks) || Map.get(ctx, "tasks") do
      formatted = format_list(tasks, "Recent Tasks")
      [formatted | parts]
    else
      parts
    end

    parts = if energy = Map.get(ctx, :energy) || Map.get(ctx, "energy") do
      ["**Energy Level:** #{energy}" | parts]
    else
      parts
    end

    case parts do
      [] -> "No additional context."
      _ -> Enum.reverse(parts) |> Enum.join("\n\n")
    end
  end

  defp additional_context(ctx) when is_binary(ctx), do: ctx
  defp additional_context(_), do: "No additional context."

  defp format_list(items, label) when is_list(items) do
    formatted =
      items
      |> Enum.take(5)
      |> Enum.map(fn
        item when is_binary(item) -> "- #{String.slice(item, 0..120)}"
        item when is_map(item) -> "- #{Map.get(item, :name) || Map.get(item, "name") || inspect(item)}"
        item -> "- #{inspect(item)}"
      end)
      |> Enum.join("\n")

    "**#{label}:**\n#{formatted}"
  end

  defp format_list(item, label) when is_binary(item) do
    "**#{label}:** #{String.slice(item, 0..300)}"
  end

  defp format_list(_, _), do: ""
end
