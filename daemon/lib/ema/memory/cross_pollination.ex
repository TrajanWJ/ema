defmodule Ema.Memory.CrossPollination do
  @moduledoc """
  Records when a user-level fact learned in one project is transplanted
  to another project's context. This is EMA's implementation of Honcho's
  cross-context learning.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "memory_cross_pollinations" do
    field :source_project_slug, :string
    field :target_project_slug, :string
    field :fact_id, :string
    field :rationale, :string
    field :applied_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  def changeset(cp, attrs) do
    cp
    |> cast(attrs, [:id, :source_project_slug, :target_project_slug, :fact_id, :rationale, :applied_at])
    |> validate_required([:id, :source_project_slug, :target_project_slug, :fact_id])
  end
end
