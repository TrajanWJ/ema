defmodule Ema.Memory.ContextAssembler do
  @moduledoc """
  Assembles pre-dispatch context for agent runs using a hot/warm/cold tiering strategy
  inspired by Honcho Pay and Loomkin's memory architecture.

  ## Tiers
  - HOT  (always included): last 2h executions + active proposals + open intents
  - WARM (if budget allows): last 48h outcomes + recently modified vault notes
  - COLD (always as headers): project description + UserFacts (constraints/preferences)

  Returns a context map ready for ContextBuilder.inject_context/2.
  """

  require Logger

  alias Ema.{Projects, Proposals, Executions}
  alias Ema.Intelligence.IntentMap
  alias Ema.Memory

  @default_max_tokens 4_000
  @hot_window_hours 2
  @warm_window_hours 48

  @doc """
  Build context for a project by slug or id.

  ## Options
  - max_tokens: integer (default 4000)
  - include: list of atoms — subset of [:hot, :warm, :cold] (default all)
  - user_id: string (default "trajan")
  """
  def context_for(project_id_or_slug, opts \\ []) do
    max_tokens = Keyword.get(opts, :max_tokens, @default_max_tokens)
    include = Keyword.get(opts, :include, [:hot, :warm, :cold])
    user_id = Keyword.get(opts, :user_id, "trajan")

    project = get_project(project_id_or_slug)

    if is_nil(project) do
      {:error, :project_not_found}
    else
      context = %{
        project_slug: project.slug,
        project_name: project.name,
        assembled_at: DateTime.utc_now(),
        token_estimate: 0,
        cold: %{},
        hot: %{},
        warm: %{}
      }

      context =
        context
        |> maybe_add_cold(project, user_id, include)
        |> maybe_add_hot(project, include)
        |> maybe_add_warm(project, include, max_tokens)
        |> estimate_tokens()

      {:ok, context}
    end
  end

  @doc """
  Convert assembled context to a prompt string for injection.
  """
  def to_prompt(%{cold: cold, hot: hot, warm: warm, project_name: name}) do
    sections = []

    sections =
      if map_size(cold) > 0 do
        user_facts_text =
          (cold[:user_facts] || [])
          |> Enum.map(fn f -> "- [#{f.category}] #{f.key}: #{f.value}" end)
          |> Enum.join("\n")

        constraint_block =
          if user_facts_text != "" do
            "## Project: #{name}\n#{cold[:description] || ""}\n\n### User Constraints & Preferences\n#{user_facts_text}"
          else
            "## Project: #{name}\n#{cold[:description] || ""}"
          end

        [constraint_block | sections]
      else
        sections
      end

    sections =
      if map_size(hot) > 0 do
        recent_text =
          (hot[:recent_executions] || [])
          |> Enum.map(fn e ->
            "- [#{e.status}] #{e.title} (#{relative_time(e.completed_at || e.inserted_at)})"
          end)
          |> Enum.join("\n")

        proposals_text =
          (hot[:active_proposals] || [])
          |> Enum.map(fn p -> "- #{p.title} [confidence: #{p.confidence || "?"}]" end)
          |> Enum.join("\n")

        intents_text =
          (hot[:open_intents] || [])
          |> Enum.map(fn i -> "- #{i.title} [#{i.status}]" end)
          |> Enum.join("\n")

        parts = []

        parts =
          if recent_text != "",
            do: ["### Recent Executions (last 2h)\n#{recent_text}" | parts],
            else: parts

        parts =
          if proposals_text != "",
            do: ["### Active Proposals\n#{proposals_text}" | parts],
            else: parts

        parts =
          if intents_text != "", do: ["### Open Intents\n#{intents_text}" | parts], else: parts

        if parts != [] do
          [Enum.join(Enum.reverse(parts), "\n\n") | sections]
        else
          sections
        end
      else
        sections
      end

    sections =
      if map_size(warm) > 0 do
        outcomes_text =
          (warm[:recent_outcomes] || [])
          |> Enum.map(fn e ->
            "- [#{e.status}] #{e.title} (#{relative_time(e.completed_at || e.inserted_at)})"
          end)
          |> Enum.join("\n")

        vault_text =
          (warm[:vault_notes] || [])
          |> Enum.map(fn n -> "- #{n}" end)
          |> Enum.join("\n")

        parts = []

        parts =
          if outcomes_text != "",
            do: ["### Recent Outcomes (last 48h)\n#{outcomes_text}" | parts],
            else: parts

        parts =
          if vault_text != "",
            do: ["### Relevant Vault Notes\n#{vault_text}" | parts],
            else: parts

        if parts != [] do
          [Enum.join(Enum.reverse(parts), "\n\n") | sections]
        else
          sections
        end
      else
        sections
      end

    Enum.reverse(sections) |> Enum.join("\n\n---\n\n")
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp get_project(slug_or_id) when is_binary(slug_or_id) do
    Projects.get_project(slug_or_id) ||
      Projects.get_project_by_slug(slug_or_id) ||
      if Regex.match?(~r/^\d+$/, slug_or_id),
        do: Projects.get_project(String.to_integer(slug_or_id))
  rescue
    _ -> nil
  end

  defp get_project(_), do: nil

  defp maybe_add_cold(ctx, project, user_id, include) do
    if :cold in include do
      user_facts =
        try do
          Memory.user_facts_for(user_id, project_slug: project.slug)
        rescue
          _ -> []
        end

      Map.put(ctx, :cold, %{
        description: project.description || "",
        user_facts: user_facts
      })
    else
      ctx
    end
  end

  defp maybe_add_hot(ctx, project, include) do
    if :hot in include do
      cutoff = DateTime.add(DateTime.utc_now(), -@hot_window_hours * 3600, :second)

      recent_executions =
        try do
          Executions.list_executions(project_slug: project.slug)
          |> Enum.filter(fn e ->
            ts = e.completed_at || e.inserted_at
            ts && DateTime.compare(ts, cutoff) == :gt
          end)
          |> Enum.take(5)
          |> Enum.map(&Map.take(&1, [:id, :title, :mode, :status, :completed_at, :inserted_at]))
        rescue
          _ -> []
        end

      active_proposals =
        try do
          Proposals.list_proposals(project_id: project.id)
          |> Enum.filter(&(&1.status in ["pending", "open"]))
          |> Enum.take(5)
          |> Enum.map(&Map.take(&1, [:id, :title, :status, :confidence, :inserted_at]))
        rescue
          _ -> []
        end

      open_intents =
        try do
          IntentMap.list_nodes(project_id: project.id)
          |> Enum.filter(&(&1.status in ["active", "open", "in_progress"]))
          |> Enum.take(5)
          |> Enum.map(&Map.take(&1, [:id, :title, :status, :level]))
        rescue
          _ -> []
        end

      Map.put(ctx, :hot, %{
        recent_executions: recent_executions,
        active_proposals: active_proposals,
        open_intents: open_intents
      })
    else
      ctx
    end
  end

  defp maybe_add_warm(ctx, project, include, max_tokens) do
    if :warm in include do
      # Only include warm tier if we have token budget left
      cold_estimate = estimate_tier_tokens(ctx.cold)
      hot_estimate = estimate_tier_tokens(ctx.hot)
      remaining = max_tokens - cold_estimate - hot_estimate

      if remaining > 500 do
        cutoff = DateTime.add(DateTime.utc_now(), -@warm_window_hours * 3600, :second)

        recent_outcomes =
          try do
            Executions.list_executions(project_slug: project.slug)
            |> Enum.filter(fn e ->
              ts = e.completed_at || e.inserted_at

              ts && DateTime.compare(ts, cutoff) == :gt &&
                e.status in ["completed", "done", "success", "failed"]
            end)
            |> Enum.take(10)
            |> Enum.map(&Map.take(&1, [:id, :title, :mode, :status, :completed_at, :inserted_at]))
          rescue
            _ -> []
          end

        vault_notes = get_vault_notes(project, 5)

        Map.put(ctx, :warm, %{
          recent_outcomes: recent_outcomes,
          vault_notes: vault_notes
        })
      else
        ctx
      end
    else
      ctx
    end
  end

  defp get_vault_notes(project, limit) do
    try do
      vault_path = Ema.Config.vault_path()
      project_dir = Path.join(vault_path, "Projects")

      if File.dir?(project_dir) do
        project_dir
        |> File.ls!()
        |> Enum.filter(
          &String.contains?(String.downcase(&1), String.downcase(project.name || project.slug))
        )
        |> Enum.take(limit)
      else
        []
      end
    rescue
      _ -> []
    end
  end

  defp estimate_tokens(ctx) do
    total =
      estimate_tier_tokens(ctx.cold) + estimate_tier_tokens(ctx.hot) +
        estimate_tier_tokens(ctx.warm)

    Map.put(ctx, :token_estimate, total)
  end

  defp estimate_tier_tokens(tier) when map_size(tier) == 0, do: 0

  defp estimate_tier_tokens(tier) do
    tier
    |> inspect()
    |> String.length()
    # rough chars-to-tokens ratio
    |> div(4)
  end

  defp relative_time(nil), do: "unknown"

  defp relative_time(%DateTime{} = dt) do
    diff = DateTime.diff(DateTime.utc_now(), dt, :minute)

    cond do
      diff < 60 -> "#{diff}m ago"
      diff < 1440 -> "#{div(diff, 60)}h ago"
      true -> "#{div(diff, 1440)}d ago"
    end
  end

  defp relative_time(_), do: "unknown"
end
