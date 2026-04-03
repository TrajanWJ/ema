defmodule Ema.Intelligence.IntentNode do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "intent_nodes" do
    field :title, :string
    field :description, :string
    field :level, :integer, default: 0
    field :status, :string, default: "planned"
    field :linked_task_ids, :string, default: "[]"
    field :linked_wiki_path, :string

    belongs_to :parent, __MODULE__, type: :string
    belongs_to :project, Ema.Projects.Project, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(planned partial complete)
  @level_names %{0 => "product", 1 => "flow", 2 => "action", 3 => "system", 4 => "implementation"}

  def level_name(level), do: Map.get(@level_names, level, "unknown")

  def changeset(node, attrs) do
    node
    |> cast(attrs, [:id, :title, :description, :level, :parent_id, :status, :project_id, :linked_task_ids, :linked_wiki_path])
    |> validate_required([:id, :title, :level])
    |> validate_inclusion(:status, @valid_statuses)
    |> validate_number(:level, greater_than_or_equal_to: 0, less_than_or_equal_to: 4)
  end
end
