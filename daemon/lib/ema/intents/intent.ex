defmodule Ema.Intents.Intent do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @levels %{0 => :vision, 1 => :goal, 2 => :project, 3 => :feature, 4 => :task, 5 => :execution}
  @kinds ~w(goal question task feature exploration fix audit system)
  @statuses ~w(planned active researched outlined implementing complete blocked archived)
  @source_types ~w(brain_dump proposal execution harvest goal structural crystallized manual mcp wiki)
  @provenance_classes ~w(high medium low)

  schema "intents" do
    field :title, :string
    field :slug, :string
    field :description, :string
    field :level, :integer, default: 4
    field :kind, :string, default: "task"
    field :source_fingerprint, :string
    field :source_type, :string, default: "manual"

    # Mutable state
    field :status, :string, default: "planned"
    field :phase, :integer, default: 1
    field :completion_pct, :integer, default: 0
    field :clarity, :float, default: 0.0
    field :energy, :float, default: 0.0
    field :priority, :integer, default: 3
    field :confidence, :float, default: 1.0
    field :provenance_class, :string, default: "high"
    field :confirmed_at, :utc_datetime
    field :tags, :string
    field :metadata, :string

    # Relationships
    belongs_to :parent, __MODULE__, type: :string
    belongs_to :project, Ema.Projects.Project, type: :string
    has_many :children, __MODULE__, foreign_key: :parent_id
    has_many :links, Ema.Intents.IntentLink, foreign_key: :intent_id
    has_many :events, Ema.Intents.IntentEvent, foreign_key: :intent_id

    timestamps(type: :utc_datetime)
  end

  def changeset(intent, attrs) do
    intent
    |> cast(attrs, [
      :id, :title, :slug, :description, :level, :kind, :parent_id, :project_id,
      :source_fingerprint, :source_type, :status, :phase, :completion_pct,
      :clarity, :energy, :priority, :confidence, :provenance_class,
      :confirmed_at, :tags, :metadata
    ])
    |> validate_required([:title, :level, :kind, :source_type])
    |> validate_inclusion(:level, 0..5)
    |> validate_inclusion(:kind, @kinds)
    |> validate_inclusion(:status, @statuses)
    |> validate_inclusion(:source_type, @source_types)
    |> validate_inclusion(:provenance_class, @provenance_classes)
    |> validate_number(:phase, greater_than_or_equal_to: 1, less_than_or_equal_to: 5)
    |> validate_number(:completion_pct, greater_than_or_equal_to: 0, less_than_or_equal_to: 100)
    |> validate_number(:priority, greater_than_or_equal_to: 0, less_than_or_equal_to: 4)
    |> maybe_generate_id()
    |> maybe_generate_slug()
    |> unique_constraint(:slug)
    |> unique_constraint(:source_fingerprint)
  end

  def level_name(level), do: Map.get(@levels, level, :unknown)

  def decode_tags(%__MODULE__{tags: nil}), do: []
  def decode_tags(%__MODULE__{tags: tags}) when is_binary(tags) do
    case Jason.decode(tags) do
      {:ok, list} when is_list(list) -> list
      _ -> []
    end
  end

  def decode_metadata(%__MODULE__{metadata: nil}), do: %{}
  def decode_metadata(%__MODULE__{metadata: meta}) when is_binary(meta) do
    case Jason.decode(meta) do
      {:ok, map} when is_map(map) -> map
      _ -> %{}
    end
  end

  defp maybe_generate_id(changeset) do
    case get_field(changeset, :id) do
      nil ->
        ts = System.system_time(:millisecond)
        rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
        put_change(changeset, :id, "int_#{ts}_#{rand}")

      _ ->
        changeset
    end
  end

  defp maybe_generate_slug(changeset) do
    case get_change(changeset, :slug) do
      nil ->
        case get_change(changeset, :title) do
          nil -> changeset
          title -> put_change(changeset, :slug, slugify(title))
        end
      _ -> changeset
    end
  end

  defp slugify(text) do
    text
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s-]/, "")
    |> String.replace(~r/\s+/, "-")
    |> String.trim("-")
    |> String.slice(0, 60)
  end
end
