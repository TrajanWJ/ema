defmodule Ema.Intelligence.ReflexionEntry do
  @moduledoc "Stored execution lessons used for reflexion prompt injection."

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "reflexion_entries" do
    field(:agent, :string)
    field(:domain, :string)
    field(:project_slug, :string)
    field(:lesson, :string)
    field(:outcome_status, :string)

    timestamps(updated_at: false, type: :utc_datetime)
  end

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [:agent, :domain, :project_slug, :lesson, :outcome_status])
    |> validate_required([:agent, :domain, :project_slug, :lesson, :outcome_status])
    |> validate_length(:lesson, min: 3, max: 2_000)
    |> validate_length(:agent, min: 1, max: 100)
    |> validate_length(:domain, min: 1, max: 100)
    |> validate_length(:project_slug, min: 1, max: 200)
    |> validate_length(:outcome_status, min: 1, max: 50)
  end
end
