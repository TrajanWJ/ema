defmodule EmaWeb.ProposalController do
  use EmaWeb, :controller

  alias Ema.Proposals

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_put(:project_id, params["project_id"])
      |> maybe_put(:status, params["status"])
      |> maybe_put(:limit, parse_int(params["limit"]))

    proposals = Proposals.list_proposals(opts) |> Enum.map(&serialize_proposal/1)
    json(conn, %{proposals: proposals})
  end

  def create(conn, params) do
    attrs = %{
      title: params["title"],
      body: params["body"],
      summary: params["summary"],
      status: params["status"] || "queued",
      project_id: params["project_id"]
    }

    case Proposals.create_proposal(attrs) do
      {:ok, proposal} ->
        conn |> put_status(:created) |> json(serialize_proposal(proposal))
      {:error, changeset} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(changeset.errors)})
    end
  end

  def show(conn, %{"id" => id}) do
    case Proposals.get_proposal(id) do
      nil ->
        {:error, :not_found}

      proposal ->
        tags = Proposals.list_tags(proposal.id) |> Enum.map(&serialize_tag/1)
        json(conn, %{proposal: serialize_proposal(proposal), tags: tags})
    end
  end

  def approve(conn, %{"id" => id}) do
    with {:ok, proposal} <- Proposals.approve_proposal(id) do
      json(conn, serialize_proposal(proposal))
    end
  end

  def redirect(conn, %{"id" => id} = params) do
    note = params["note"] || ""

    with {:ok, proposal, seeds} <- Proposals.redirect_proposal(id, note) do
      json(conn, %{
        proposal: serialize_proposal(proposal),
        seeds_created: Enum.map(seeds, &serialize_seed/1)
      })
    end
  end

  def kill(conn, %{"id" => id}) do
    with {:ok, proposal} <- Proposals.kill_proposal(id) do
      json(conn, serialize_proposal(proposal))
    end
  end

  def lineage(conn, %{"id" => id}) do
    with {:ok, lineage} <- Proposals.get_lineage(id) do
      json(conn, %{
        proposal: serialize_proposal(lineage.proposal),
        parents: Enum.map(lineage.parents, &serialize_proposal/1),
        children: Enum.map(lineage.children, &serialize_proposal/1)
      })
    end
  end

  # ── Batch 3: Pipeline Orchestrator endpoints ──────────────────────────────

  @doc """
  POST /api/proposals/generate
  Start a new proposal pipeline via the Orchestrator.

  Body: { seed_id: string, project_id?: string, context?: object }
  Returns: { proposal_id, pubsub_topic } (pipeline runs async)
  """
  def generate(conn, params) do
    seed_id = params["seed_id"]
    project_id = params["project_id"]
    context = params["context"] || %{}

    with {:ok, seed} <- fetch_seed(seed_id),
         {:ok, checked_seed, preflight_diag} <- run_preflight(seed) do
      project = if(project_id, do: Ema.Projects.get_project(project_id))
      enriched_context = Map.put(context, "preflight", preflight_diag)

      case Ema.Proposals.Orchestrator.start_proposal(checked_seed, project, enriched_context) do
        {:ok, proposal_id, pubsub_topic} ->
          conn
          |> put_status(:accepted)
          |> json(%{
            proposal_id: proposal_id,
            pubsub_topic: pubsub_topic,
            preflight: %{
              result: preflight_diag[:result],
              score: preflight_diag[:enriched_score] || preflight_diag[:initial_score]
            },
            message: "Pipeline started. Subscribe to topic for streaming updates."
          })

        {:error, reason} ->
          conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
      end
    end
  end

  @doc """
  DELETE /api/proposals/:id/cancel
  Cancel an active proposal pipeline.
  """
  def cancel(conn, %{"id" => id}) do
    Ema.Proposals.Orchestrator.cancel_proposal(id)
    json(conn, %{status: "cancelled", proposal_id: id})
  end

  @doc """
  GET /api/proposals/pipelines
  List all active proposal pipelines.
  """
  def pipelines(conn, _params) do
    active = Ema.Proposals.Orchestrator.active_pipelines()
    json(conn, %{pipelines: active})
  end

  @doc """
  GET /api/proposals/:id/cost
  Get cost breakdown for a proposal.
  """
  def cost(conn, %{"id" => id}) do
    cost_data = Ema.Proposals.CostAggregator.proposal_cost(id)
    json(conn, cost_data)
  end

  def surfaced(conn, _params) do
    proposals = Proposals.list_proposals(status: "queued")
    json(conn, %{proposals: Enum.map(proposals, &serialize_proposal/1)})
  end

  @doc """
  GET /api/proposals/budget
  Get daily AI budget status.
  """
  def budget(conn, _params) do
    spend = Ema.Proposals.CostAggregator.daily_spend()
    budget = Ema.Proposals.CostAggregator.daily_budget()
    check = Ema.Proposals.CostAggregator.budget_check()

    status = case check do
      :ok -> "ok"
      {:warning, _} -> "warning"
      {:blocked, _} -> "blocked"
    end

    json(conn, %{
      daily_spend_usd: spend,
      daily_budget_usd: budget,
      pct_used: if(budget > 0, do: Float.round(spend / budget * 100, 1), else: 0.0),
      status: status
    })
  end

  @doc """
  GET /api/proposals/compare?ids[]=id1&ids[]=id2
  Compare multiple proposals by IDs.
  """
  def compare(conn, %{"ids" => ids}) when is_list(ids) do
    proposals = Proposals.compare_proposals(ids) |> Enum.map(&serialize_proposal/1)
    json(conn, %{proposals: proposals})
  end

  def compare(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "ids parameter required"})
  end

  # ── Private helpers ────────────────────────────────────────────────────────

  defp fetch_seed(nil), do: {:error, :bad_request}
  defp fetch_seed(seed_id) do
    case Proposals.get_seed(seed_id) do
      nil -> {:error, :not_found}
      seed -> {:ok, seed}
    end
  end

  defp run_preflight(seed) do
    case Ema.Proposals.SeedPreflight.check(seed) do
      {:pass, checked, diag} -> {:ok, checked, diag}
      {:rewrite, checked, diag} -> {:ok, checked, diag}
      {:duplicate, _nil, diag} -> {:error, {:preflight_duplicate, diag}}
      {:reject, _nil, diag} -> {:error, {:preflight_rejected, diag}}
    end
  end

  defp serialize_proposal(proposal) do
    %{
      id: proposal.id,
      title: proposal.title,
      summary: proposal.summary,
      body: proposal.body,
      status: proposal.status,
      confidence: proposal.confidence,
      risks: proposal.risks,
      benefits: proposal.benefits,
      estimated_scope: proposal.estimated_scope,
      steelman: proposal.steelman,
      red_team: proposal.red_team,
      synthesis: proposal.synthesis,
      generation_log: proposal.generation_log,
      idea_score: proposal.idea_score,
      prompt_quality_score: proposal.prompt_quality_score,
      score_breakdown: proposal.score_breakdown,
      project_id: proposal.project_id,
      seed_id: Map.get(proposal, :seed_id),
      parent_proposal_id: proposal.parent_proposal_id,
      # Batch 3 fields
      quality_score: Map.get(proposal, :quality_score),
      pipeline_stage: Map.get(proposal, :pipeline_stage),
      pipeline_iteration: Map.get(proposal, :pipeline_iteration, 1),
      cost_display: Map.get(proposal, :cost_display),
      created_at: proposal.inserted_at,
      updated_at: proposal.updated_at
    }
  end

  defp serialize_tag(tag) do
    %{
      id: tag.id,
      category: tag.category,
      label: tag.label,
      proposal_id: tag.proposal_id,
      created_at: tag.inserted_at
    }
  end

  defp serialize_seed(seed) do
    %{
      id: seed.id,
      name: seed.name,
      seed_type: seed.seed_type,
      active: seed.active
    }
  end

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)

  defp parse_int(nil), do: nil

  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {n, ""} -> n
      _ -> nil
    end
  end

  defp parse_int(val) when is_integer(val), do: val
  defp parse_int(_), do: nil
end
