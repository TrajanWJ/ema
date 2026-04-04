defmodule Ema.Memory.UserFact do
  @moduledoc """
  Persistent user-level memory — preferences, patterns, and inferred beliefs
  about how a user works. Analogous to Honcho's "peer representation" layer.

  Examples:
    - "prefers_incremental_migration" → "true"
    - "avoid_billing_code" → "StudioKamel billing module"
    - "test_coverage_standard" → "80% min before ship"
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @categories ~w(general preference pattern constraint project_specific)
  @sources ~w(manual inferred cross_pollination)

  schema "memory_user_facts" do
    field :user_id, :string, default: "trajan"
    field :key, :string
    field :value, :string
    field :category, :string, default: "general"
    field :weight, :float, default: 0.5
    field :source, :string, default: "manual"
    field :project_slug, :string
    field :metadata, :map, default: %{}

    timestamps(type: :utc_datetime)
  end

  def changeset(fact, attrs) do
    fact
    |> cast(attrs, [:id, :user_id, :key, :value, :category, :weight, :source, :project_slug, :metadata])
    |> validate_required([:id, :key, :value])
    |> validate_inclusion(:category, @categories)
    |> validate_inclusion(:source, @sources)
    |> validate_number(:weight, greater_than_or_equal_to: 0.0, less_than_or_equal_to: 1.0)
    |> unique_constraint([:user_id, :key])
  end
end
