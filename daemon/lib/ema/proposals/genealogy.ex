defmodule Ema.Proposals.Genealogy do
  @moduledoc """
  Proposal genealogy tracking — lineage, descendants, and validation gates.
  Enables tracing the evolution of ideas through generations of proposals.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Proposals.Proposal

  @doc "Walk ancestors from this proposal up to the root, returned oldest-first."
  def lineage(proposal_id) do
    case Repo.get(Proposal, proposal_id) do
      nil ->
        {:error, :not_found}

      proposal ->
        ancestors = walk_ancestors(proposal, [])
        {:ok, Enum.reverse(ancestors)}
    end
  end

  @doc "Find all descendants where genealogy_path contains this proposal's ID."
  def descendants(proposal_id) do
    pattern = "%/#{proposal_id}/%"

    query =
      from p in Proposal,
        where: like(p.genealogy_path, ^pattern) or p.parent_proposal_id == ^proposal_id,
        order_by: [asc: p.generation]

    {:ok, Repo.all(query)}
  end

  @doc "Build the full family tree from the root ancestor of this proposal."
  def family_tree(proposal_id) do
    with {:ok, ancestors} <- lineage(proposal_id) do
      root_id =
        case ancestors do
          [root | _] -> root.id
          [] -> proposal_id
        end

      {:ok, descendants} = descendants(root_id)
      root = Repo.get(Proposal, root_id)

      tree = build_tree(root, descendants)
      {:ok, tree}
    end
  end

  @doc "Set parent relationship, computing generation and genealogy path."
  def set_parent(proposal_id, parent_id) do
    with %Proposal{} = proposal <- Repo.get(Proposal, proposal_id),
         %Proposal{} = parent <- Repo.get(Proposal, parent_id) do
      parent_generation = parent.generation || 0
      parent_path = parent.genealogy_path || "/#{parent.id}/"

      new_path = "#{parent_path}#{proposal_id}/"

      proposal
      |> Ecto.Changeset.change(%{
        parent_proposal_id: parent_id,
        generation: parent_generation + 1,
        genealogy_path: new_path
      })
      |> Repo.update()
    else
      nil -> {:error, :not_found}
    end
  end

  @doc """
  Validate a proposal against a list of gates.
  Gates: list of {name, :pass | :fail} tuples.
  Computes validation_score as pass_count / total_count.
  """
  def validate_gates(proposal_id, gates) when is_list(gates) do
    case Repo.get(Proposal, proposal_id) do
      nil ->
        {:error, :not_found}

      proposal ->
        {passed, failed} =
          Enum.split_with(gates, fn {_name, result} -> result == :pass end)

        passed_names = Enum.map(passed, fn {name, _} -> name end)
        failed_names = Enum.map(failed, fn {name, _} -> name end)
        total = length(gates)
        score = if total > 0, do: length(passed) / total, else: 0.0

        proposal
        |> Ecto.Changeset.change(%{
          validation_score: score,
          validation_gates_passed: Jason.encode!(passed_names),
          validation_gates_failed: Jason.encode!(failed_names)
        })
        |> Repo.update()
    end
  end

  @doc "Run default validation gates against a proposal."
  def run_default_gates(%Proposal{} = proposal) do
    gates = [
      {"has_title", if(proposal.title && proposal.title != "", do: :pass, else: :fail)},
      {"has_description", if(proposal.summary && proposal.summary != "", do: :pass, else: :fail)},
      {"has_tags", if(proposal.tags && proposal.tags != [], do: :pass, else: :fail)},
      {"score_above_threshold", if((proposal.confidence || 0.0) >= 0.3, do: :pass, else: :fail)}
    ]

    validate_gates(proposal.id, gates)
  end

  # Private helpers

  defp walk_ancestors(%Proposal{parent_proposal_id: nil}, acc), do: acc

  defp walk_ancestors(%Proposal{parent_proposal_id: parent_id}, acc) do
    case Repo.get(Proposal, parent_id) do
      nil -> acc
      parent -> walk_ancestors(parent, [parent | acc])
    end
  end

  defp build_tree(nil, _descendants), do: nil

  defp build_tree(node, descendants) do
    children =
      descendants
      |> Enum.filter(&(&1.parent_proposal_id == node.id))
      |> Enum.map(&build_tree(&1, descendants))

    %{proposal: node, children: children}
  end
end
