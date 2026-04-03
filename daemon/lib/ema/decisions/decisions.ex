defmodule Ema.Decisions do
  @moduledoc """
  Decisions — records important decisions with context, options, and outcomes.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Decisions.Decision

  def list_decisions do
    Decision
    |> order_by(desc: :inserted_at)
    |> Repo.all()
  end

  def get_decision!(id), do: Repo.get!(Decision, id)

  def create_decision(attrs) do
    %Decision{}
    |> Decision.changeset(attrs)
    |> Repo.insert()
  end

  def update_decision(%Decision{} = decision, attrs) do
    decision
    |> Decision.changeset(attrs)
    |> Repo.update()
  end

  def delete_decision(%Decision{} = decision) do
    Repo.delete(decision)
  end
end
