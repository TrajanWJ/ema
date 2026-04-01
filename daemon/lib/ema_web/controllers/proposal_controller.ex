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
      seed_id: proposal.seed_id,
      parent_proposal_id: proposal.parent_proposal_id,
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
