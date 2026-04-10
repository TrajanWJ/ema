defmodule Ema.ProposalEngine.Composer do
  @moduledoc """
  Pure local compilation step that runs BEFORE the Generator calls Claude.

  Pattern source: InkOS — compile context, rule-stack, and trace artifacts
  to disk so a human (or another agent) can see *exactly* what the Generator
  will see, **before** any tokens are spent.

  Writes four artifacts under
  `~/.local/share/ema/vault/runtime/proposals/<seed_id>/`:

    - `intent.md`      — current intent focus the proposal serves
    - `context.json`   — compiled context bundle (project, gaps, code)
    - `rule-stack.yaml`— deterministic rules the Generator must respect
    - `trace.json`     — provenance: when, by whom, from which sources

  This is intentionally side-effect-free w.r.t. the database. It is a pure
  read of system state and a write to local disk. If composition fails the
  Generator should fall back to its existing prompt path.
  """

  require Logger

  @doc """
  Compose runtime artifacts for a seed and return them as a map.

  Always returns a map; failures are caught and logged so this never blocks
  the Generator.
  """
  def compose(seed) do
    intent = current_intent_focus()
    context = gather_context(seed)
    rule_stack = build_rule_stack(seed)

    trace = %{
      compiled_at: DateTime.utc_now() |> DateTime.to_iso8601(),
      seed_id: seed.id,
      seed_name: seed.name,
      project_id: seed.project_id,
      sources: context_sources(context),
      composer_version: 1
    }

    artifacts = %{
      intent: intent,
      context: context,
      rule_stack: rule_stack,
      trace: trace
    }

    try do
      write_runtime_artifacts(seed.id, artifacts)
    rescue
      e ->
        Logger.warning("Composer: failed to write artifacts for seed #{seed.id}: #{inspect(e)}")
    end

    artifacts
  end

  @doc "Return the absolute directory path where artifacts for a seed live."
  def artifact_dir(seed_id) do
    base = Application.get_env(:ema, :vault_root, default_vault_root())
    Path.join([base, "runtime", "proposals", to_string(seed_id)])
  end

  # ── Intent ────────────────────────────────────────────────────────────────

  defp current_intent_focus do
    try do
      # Prefer a dedicated function if it exists; fall back to the active
      # intents tree exported as markdown.
      cond do
        function_exported?(Ema.Intents, :get_current_focus, 0) ->
          apply(Ema.Intents, :get_current_focus, [])

        function_exported?(Ema.Intents, :export_markdown, 1) ->
          apply(Ema.Intents, :export_markdown, [[status: "active"]])

        function_exported?(Ema.Intents, :export_markdown, 0) ->
          apply(Ema.Intents, :export_markdown, [])

        true ->
          "_No intent focus available._"
      end
    rescue
      _ -> "_Failed to read intent focus._"
    end
  end

  # ── Context bundle ────────────────────────────────────────────────────────

  defp gather_context(seed) do
    project =
      if seed.project_id do
        try_get(fn -> Ema.Projects.get_project(seed.project_id) end)
      end

    %{
      seed: %{
        id: seed.id,
        name: seed.name,
        prompt_template: seed.prompt_template,
        project_id: seed.project_id
      },
      project: serialize_project(project),
      recent_proposals:
        try_get(fn ->
          Ema.Proposals.list_proposals(limit: 5)
          |> Enum.map(&serialize_proposal/1)
        end) || [],
      active_tasks:
        try_get(fn ->
          mod = Ema.Tasks

          if Code.ensure_loaded?(mod) and function_exported?(mod, :list_active, 0) do
            apply(mod, :list_active, [])
            |> Enum.take(10)
            |> Enum.map(&serialize_task/1)
          else
            []
          end
        end) || []
    }
  end

  defp serialize_project(nil), do: nil

  defp serialize_project(p) do
    %{
      id: p.id,
      slug: Map.get(p, :slug),
      name: Map.get(p, :name),
      path: Map.get(p, :path)
    }
  end

  defp serialize_proposal(p) do
    %{
      id: p.id,
      title: p.title,
      status: p.status,
      confidence: p.confidence
    }
  end

  defp serialize_task(t) do
    %{id: t.id, title: Map.get(t, :title), status: Map.get(t, :status)}
  end

  defp try_get(fun) do
    try do
      fun.()
    rescue
      _ -> nil
    end
  end

  defp context_sources(context) do
    %{
      project: not is_nil(context[:project]),
      recent_proposals: length(context[:recent_proposals] || []),
      active_tasks: length(context[:active_tasks] || []),
      seed: true
    }
  end

  # ── Rule stack ────────────────────────────────────────────────────────────
  # Deterministic constraints the Generator must respect. Static for now —
  # later this can pull from settings, project conventions, and gates.
  defp build_rule_stack(seed) do
    [
      %{rule: "no_destructive_actions", level: "hard"},
      %{rule: "respect_user_intent_focus", level: "hard"},
      %{rule: "cite_evidence_for_claims", level: "soft"},
      %{rule: "scope_to_seed", level: "soft", note: "Stay within seed.name: #{seed.name}"},
      %{rule: "max_proposal_length", level: "soft", value: 2000}
    ]
  end

  # ── Disk writes ───────────────────────────────────────────────────────────

  defp write_runtime_artifacts(seed_id, artifacts) do
    dir = artifact_dir(seed_id)
    File.mkdir_p!(dir)

    File.write!(Path.join(dir, "intent.md"), to_string(artifacts.intent))

    File.write!(
      Path.join(dir, "context.json"),
      Jason.encode!(artifacts.context, pretty: true)
    )

    File.write!(Path.join(dir, "rule-stack.yaml"), to_yaml(artifacts.rule_stack))

    File.write!(
      Path.join(dir, "trace.json"),
      Jason.encode!(artifacts.trace, pretty: true)
    )
  end

  # Minimal hand-rolled YAML emitter for the rule list. We deliberately do
  # NOT add a YAML dep — these files are small and human-readable.
  defp to_yaml(rules) when is_list(rules) do
    rules
    |> Enum.map_join("\n", fn rule ->
      lines =
        rule
        |> Enum.map(fn {k, v} -> "  #{k}: #{yaml_value(v)}" end)
        |> Enum.join("\n")

      "- \n#{lines}"
    end)
    |> Kernel.<>("\n")
  end

  defp yaml_value(v) when is_binary(v), do: ~s("#{String.replace(v, "\"", "\\\"")}")
  defp yaml_value(v) when is_number(v), do: to_string(v)
  defp yaml_value(v) when is_atom(v), do: to_string(v)
  defp yaml_value(v), do: inspect(v)

  defp default_vault_root do
    Path.expand("~/.local/share/ema/vault")
  end
end
