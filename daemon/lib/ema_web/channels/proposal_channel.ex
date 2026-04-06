defmodule EmaWeb.ProposalChannel do
  @moduledoc """
  Phoenix Channel for proposal events.

  Handles two join patterns:
    - "proposals:queue"  — Subscribe to all queued proposals (existing)
    - "proposals:<id>"   — Subscribe to a specific proposal (existing, adds tags)
    - "proposal:<id>"    — Subscribe to live pipeline streaming events (NEW)
                           Used by ProposalStreamingView and ProposalDetail

  Pipeline events forwarded to the client:
    - stage_started        {stage, stage_num}
    - stage_update         {stage, text}
    - stage_complete       {stage}
    - quality_gate_failed  {feedback, iteration}
    - quality_gate_passed  {}
    - quality_gate_warning {failures}
    - complete             {id, status}
    - pipeline_error       {reason}
    - budget_alert         {pct_used, spent_usd, budget_usd, message}
  """

  use Phoenix.Channel

  alias Ema.Proposals

  # ── Existing: Queue and detail joins ──────────────────────────────────────

  @impl true
  def join("proposals:queue", _payload, socket) do
    proposals =
      Proposals.list_proposals(limit: 50)
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

  # ── NEW: Live pipeline streaming join ─────────────────────────────────────

  @impl true
  def join("proposal:" <> id, _payload, socket) do
    case Proposals.get_proposal(id) do
      nil ->
        {:error, %{reason: "not_found"}}

      proposal ->
        # Subscribe to PubSub topic for this proposal's pipeline events
        Phoenix.PubSub.subscribe(Ema.PubSub, "proposal:#{id}")

        {:ok,
         %{
           proposal_id: id,
           status: proposal.status,
           pipeline_stage: Map.get(proposal, :pipeline_stage),
           pipeline_iteration: Map.get(proposal, :pipeline_iteration, 1)
         }, assign(socket, :proposal_id, id)}
    end
  end

  # ── Handle pipeline PubSub events and forward to WebSocket client ─────────

  @impl true
  def handle_info(event, socket) when is_tuple(event) do
    proposal_id = socket.assigns[:proposal_id]

    case event do
      {:stage_started, stage, stage_num} ->
        push(socket, "stage_started", %{
          stage: Atom.to_string(stage),
          stage_num: stage_num
        })

      {:stage_update, stage, text} ->
        push(socket, "stage_update", %{
          stage: Atom.to_string(stage),
          text: text
        })

      {:stage_complete, stage, _output} ->
        push(socket, "stage_complete", %{
          stage: Atom.to_string(stage)
        })

      {:quality_gate_failed, feedback, iteration} ->
        push(socket, "quality_gate_failed", %{
          feedback: feedback,
          iteration: iteration
        })

      {:quality_gate_passed, proposal} ->
        push(socket, "quality_gate_passed", %{
          proposal_id: proposal.id
        })

      {:quality_gate_warning, _proposal, failures} ->
        push(socket, "quality_gate_warning", %{
          failures: failures
        })

      {:complete, proposal} ->
        push(socket, "complete", %{
          id: proposal.id,
          status: proposal.status,
          quality_score: Map.get(proposal, :quality_score),
          cost_display: Map.get(proposal, :cost_display)
        })

      {:pipeline_error, reason} ->
        push(socket, "pipeline_error", %{
          reason: inspect(reason)
        })

      {:budget_alert, data} when is_map(data) ->
        push(socket, "budget_alert", data)

      _ ->
        :ok
    end

    if proposal_id do
      {:noreply, socket}
    else
      {:noreply, socket}
    end
  end

  @impl true
  def handle_info(_msg, socket), do: {:noreply, socket}

  # ── Serializers ────────────────────────────────────────────────────────────

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
      seed_id: Map.get(proposal, :seed_id),
      parent_proposal_id: proposal.parent_proposal_id,
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
      label: tag.label
    }
  end
end
