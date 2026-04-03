defmodule Ema.Intelligence.Gap do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "gaps" do
    field :source, :string
    field :gap_type, :string
    field :title, :string
    field :description, :string
    field :severity, :string, default: "medium"
    field :file_path, :string
    field :line_number, :integer
    field :status, :string, default: "open"
    field :resolved_at, :utc_datetime

    belongs_to :project, Ema.Projects.Project, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_sources ~w(superman todos wiki tasks goals docs orphans)
  @valid_severities ~w(critical high medium low)
  @valid_statuses ~w(open resolved ignored)

  def changeset(gap, attrs) do
    gap
    |> cast(attrs, [:id, :source, :gap_type, :title, :description, :severity, :project_id, :file_path, :line_number, :status, :resolved_at])
    |> validate_required([:id, :source, :gap_type, :title])
    |> validate_inclusion(:source, @valid_sources)
    |> validate_inclusion(:severity, @valid_severities)
    |> validate_inclusion(:status, @valid_statuses)
  end
end
