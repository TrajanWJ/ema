defmodule Ema.Proposals.ProposalTag do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "proposal_tags" do
    field :category, :string
    field :label, :string

    belongs_to :proposal, Ema.Proposals.Proposal, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_categories ~w(domain type custom)

  def changeset(tag, attrs) do
    tag
    |> cast(attrs, [:id, :category, :label, :proposal_id])
    |> validate_required([:id, :category, :label, :proposal_id])
    |> validate_inclusion(:category, @valid_categories)
  end
end
