defmodule Ema.Proposals.Seed do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "proposal_seeds" do
    field :name, :string
    field :prompt_template, :string
    field :seed_type, :string
    field :schedule, :string
    field :active, :boolean, default: true
    field :last_run_at, :utc_datetime
    field :run_count, :integer, default: 0
    field :context_injection, :map, default: %{}
    field :metadata, :map, default: %{}

    belongs_to :project, Ema.Projects.Project, type: :string

    has_many :proposals, Ema.Proposals.Proposal

    timestamps(type: :utc_datetime)
  end

  @valid_seed_types ~w(cron git session vault usage brain_dump cross dependency)

  def changeset(seed, attrs) do
    seed
    |> cast(attrs, [
      :id,
      :name,
      :prompt_template,
      :seed_type,
      :schedule,
      :active,
      :last_run_at,
      :run_count,
      :context_injection,
      :metadata,
      :project_id
    ])
    |> validate_required([:id, :name, :prompt_template, :seed_type])
    |> validate_inclusion(:seed_type, @valid_seed_types)
  end
end
