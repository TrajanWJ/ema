defmodule Ema.Proposals do
  @moduledoc """
  Proposals -- autonomous ideation engine context.
  Manages proposals, seeds, and tags through the pipeline lifecycle.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Proposals.{Proposal, Seed, ProposalTag}

  # --- Proposals ---

  def list_proposals(opts \\ []) do
    Proposal
    |> maybe_filter_by(:project_id, opts[:project_id])
    |> maybe_filter_by(:status, opts[:status])
    |> order_by(desc: :inserted_at)
    |> maybe_limit(opts[:limit])
    |> Repo.all()
  end

  def get_proposal(id) do
    Proposal
    |> Repo.get(id)
    |> maybe_preload([:tags, :children])
  end

  def create_proposal(attrs) do
    id = generate_id("prop")

    %Proposal{}
    |> Proposal.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
    |> tap_ok(&broadcast_proposal_event("proposal_created", &1))
  end

  def update_proposal(%Proposal{} = proposal, attrs) do
    proposal
    |> Proposal.changeset(attrs)
    |> Repo.update()
    |> tap_ok(&broadcast_proposal_event("proposal_updated", &1))
  end

  def approve_proposal(id) do
    case get_proposal(id) do
      nil ->
        {:error, :not_found}

      proposal ->
        proposal
        |> Proposal.changeset(%{status: "approved"})
        |> Repo.update()
        |> tap_ok(&broadcast_proposal_event("proposal_approved", &1))
    end
  end

  def redirect_proposal(id, redirect_note) do
    case get_proposal(id) do
      nil ->
        {:error, :not_found}

      proposal ->
        Repo.transaction(fn ->
          case proposal
               |> Proposal.changeset(%{status: "redirected"})
               |> Repo.update() do
            {:ok, updated} ->
              seeds_created = create_redirect_seeds(updated, redirect_note)
              broadcast_proposal_event("proposal_redirected", updated)
              {updated, seeds_created}

            {:error, changeset} ->
              Repo.rollback(changeset)
          end
        end)
        |> case do
          {:ok, {proposal, seeds}} -> {:ok, proposal, seeds}
          {:error, reason} -> {:error, reason}
        end
    end
  end

  def kill_proposal(id) do
    case get_proposal(id) do
      nil ->
        {:error, :not_found}

      proposal ->
        proposal
        |> Proposal.changeset(%{status: "killed"})
        |> Repo.update()
        |> tap_ok(&broadcast_proposal_event("proposal_killed", &1))
    end
  end

  def get_lineage(id) do
    case get_proposal(id) do
      nil ->
        {:error, :not_found}

      proposal ->
        parent_chain = build_parent_chain(proposal, [])

        children_tree =
          Proposal
          |> where([p], p.parent_proposal_id == ^id)
          |> order_by(asc: :inserted_at)
          |> Repo.all()

        {:ok, %{proposal: proposal, parents: parent_chain, children: children_tree}}
    end
  end

  # --- Seeds ---

  def list_seeds(opts \\ []) do
    Seed
    |> maybe_filter_by(:project_id, opts[:project_id])
    |> maybe_filter_by(:active, opts[:active])
    |> maybe_filter_by(:seed_type, opts[:seed_type])
    |> order_by(desc: :inserted_at)
    |> Repo.all()
  end

  def get_seed(id), do: Repo.get(Seed, id)

  def create_seed(attrs) do
    id = generate_id("seed")

    %Seed{}
    |> Seed.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def update_seed(%Seed{} = seed, attrs) do
    seed
    |> Seed.changeset(attrs)
    |> Repo.update()
  end

  def toggle_seed(id) do
    case get_seed(id) do
      nil ->
        {:error, :not_found}

      seed ->
        seed
        |> Seed.changeset(%{active: !seed.active})
        |> Repo.update()
    end
  end

  def increment_seed_run_count(%Seed{} = seed) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    seed
    |> Seed.changeset(%{run_count: seed.run_count + 1, last_run_at: now})
    |> Repo.update()
  end

  # --- Tags ---

  def add_tag(proposal_id, attrs) do
    id = generate_id("ptag")

    %ProposalTag{}
    |> ProposalTag.changeset(Map.merge(attrs, %{id: id, proposal_id: proposal_id}))
    |> Repo.insert()
  end

  def list_tags(proposal_id) do
    ProposalTag
    |> where([t], t.proposal_id == ^proposal_id)
    |> order_by(asc: :category, asc: :label)
    |> Repo.all()
  end

  # --- Private ---

  defp create_redirect_seeds(proposal, redirect_note) do
    angles = ["alternative approach", "expanded scope", "minimal viable version"]

    Enum.flat_map(angles, fn angle ->
      attrs = %{
        name: "Redirect: #{String.slice(proposal.title, 0..40)} (#{angle})",
        prompt_template: build_redirect_prompt(proposal, redirect_note, angle),
        seed_type: "dependency",
        project_id: proposal.project_id
      }

      case create_seed(attrs) do
        {:ok, seed} -> [seed]
        {:error, _reason} -> []
      end
    end)
  end

  defp build_redirect_prompt(proposal, redirect_note, angle) do
    """
    Original proposal: #{proposal.title}
    #{proposal.body}

    User redirect note: #{redirect_note}

    Exploration angle: #{angle}

    Generate a new proposal that takes the original idea in a different direction \
    based on the redirect note and exploration angle. Be creative and divergent. \
    Output JSON with fields: title, summary, body, estimated_scope, risks, benefits.
    """
  end

  defp build_parent_chain(%Proposal{parent_proposal_id: nil}, acc), do: Enum.reverse(acc)

  defp build_parent_chain(%Proposal{parent_proposal_id: parent_id}, acc) do
    case Repo.get(Proposal, parent_id) do
      nil -> Enum.reverse(acc)
      parent -> build_parent_chain(parent, [parent | acc])
    end
  end

  defp maybe_filter_by(query, _field, nil), do: query

  defp maybe_filter_by(query, field, value) do
    where(query, [q], field(q, ^field) == ^value)
  end

  defp maybe_limit(query, nil), do: query
  defp maybe_limit(query, limit), do: limit(query, ^limit)

  defp maybe_preload(nil, _preloads), do: nil
  defp maybe_preload(record, preloads), do: Repo.preload(record, preloads)

  defp tap_ok({:ok, record} = result, fun) do
    fun.(record)
    result
  end

  defp tap_ok(error, _fun), do: error

  defp broadcast_proposal_event(event, proposal) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "proposals:events",
      {event, proposal}
    )

    EmaWeb.Endpoint.broadcast("proposals:queue", event, serialize_proposal(proposal))

    # Broadcast to Pipes EventBus for workflow automation
    pipe_event =
      case event do
        "proposal_approved" -> "proposals:approved"
        "proposal_redirected" -> "proposals:redirected"
        "proposal_killed" -> "proposals:killed"
        "proposal_created" -> "proposals:generated"
        _ -> nil
      end

    if pipe_event do
      Ema.Pipes.EventBus.broadcast_event(pipe_event, %{
        proposal_id: proposal.id,
        title: proposal.title,
        status: proposal.status,
        project_id: proposal.project_id
      })
    end
  end

  defp serialize_proposal(proposal) do
    %{
      id: proposal.id,
      title: proposal.title,
      summary: proposal.summary,
      status: proposal.status,
      confidence: proposal.confidence,
      project_id: proposal.project_id,
      created_at: proposal.inserted_at,
      updated_at: proposal.updated_at
    }
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
