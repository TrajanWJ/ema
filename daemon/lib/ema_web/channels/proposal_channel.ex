defmodule EmaWeb.ProposalChannel do
  use Phoenix.Channel

  alias Ema.Proposals

  @impl true
  def join("proposals:queue", _payload, socket) do
    proposals =
      Proposals.list_proposals(status: "queued", limit: 50)
      |> Enum.map(&serialize_proposal/1)

    {:ok, %{proposals: proposals}, socket}
  end

  @impl true
  def join("proposals:" <> id, _payload, socket) do
    case Proposals.get_proposal(id) do
      nil ->
        {:error, %{reason: "not_found"}}

      proposal ->
        tags = Proposals.list_tags(proposal.id) |> Enum.map(&serialize_tag/1)
        {:ok, %{proposal: serialize_proposal(proposal), tags: tags}, socket}
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
      label: tag.label
    }
  end
end
