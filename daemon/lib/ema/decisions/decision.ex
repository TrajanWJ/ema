defmodule Ema.Decisions.Decision do
  use Ecto.Schema
  import Ecto.Changeset

  schema "decisions" do
    field :title, :string
    field :context, :string
    field :options, {:array, :map}, default: []
    field :chosen_option, :string
    field :decided_by, :string
    field :reasoning, :string
    field :outcome, :string
    field :outcome_score, :integer
    field :tags, {:array, :string}, default: []
    field :space_id, :string
    field :reviewed_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  def changeset(decision, attrs) do
    decision
    |> cast(attrs, [
      :title,
      :context,
      :options,
      :chosen_option,
      :decided_by,
      :reasoning,
      :outcome,
      :outcome_score,
      :tags,
      :space_id,
      :reviewed_at
    ])
    |> validate_required([:title, :decided_by])
    |> validate_number(:outcome_score,
      greater_than_or_equal_to: 0,
      less_than_or_equal_to: 10
    )
  end
end
