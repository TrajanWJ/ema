defmodule Ema.Decisions.Decision do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "decisions" do
    field :title, :string
    field :context, :string
    field :options, :string, default: "[]"
    field :chosen_option, :string
    field :decided_by, :string
    field :reasoning, :string
    field :outcome, :string
    field :outcome_score, :integer
    field :tags, :string, default: "[]"

    timestamps(type: :utc_datetime)
  end

  @required_fields ~w(id title)a
  @optional_fields ~w(context options chosen_option decided_by reasoning outcome outcome_score tags)a

  def changeset(decision, attrs) do
    decision
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:outcome_score,
      greater_than_or_equal_to: 1,
      less_than_or_equal_to: 5
    )
  end
end
