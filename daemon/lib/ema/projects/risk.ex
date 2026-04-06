defmodule Ema.Projects.Risk do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "project_risks" do
    field :project_id, :string
    field :description, :string
    field :probability, :string, default: "medium"
    field :impact, :string, default: "medium"
    field :mitigation, :string
    field :status, :string, default: "open"

    timestamps(type: :utc_datetime)
  end

  @valid_probability ~w(low medium high)
  @valid_impact ~w(low medium high)
  @valid_statuses ~w(open mitigated closed)

  def changeset(risk, attrs) do
    risk
    |> cast(attrs, [:id, :project_id, :description, :probability, :impact, :mitigation, :status])
    |> validate_required([:id, :project_id, :description])
    |> validate_inclusion(:probability, @valid_probability)
    |> validate_inclusion(:impact, @valid_impact)
    |> validate_inclusion(:status, @valid_statuses)
  end
end
