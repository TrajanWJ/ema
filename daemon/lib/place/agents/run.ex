defmodule Place.Agents.Run do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "agent_runs" do
    field :project_path, :string
    field :status, :string, default: "pending"
    field :started_at, :utc_datetime
    field :output_path, :string
    field :exit_code, :integer

    belongs_to :template, Place.Agents.Template, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(pending running completed failed)

  def changeset(run, attrs) do
    run
    |> cast(attrs, [:id, :project_path, :status, :started_at, :output_path, :exit_code, :template_id])
    |> validate_required([:id])
    |> validate_inclusion(:status, @valid_statuses)
  end
end
