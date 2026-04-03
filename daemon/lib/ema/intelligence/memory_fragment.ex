defmodule Ema.Intelligence.MemoryFragment do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "memory_fragments" do
    field :fragment_type, :string
    field :content, :string
    field :importance_score, :float, default: 0.5
    field :project_path, :string

    belongs_to :session, Ema.ClaudeSessions.ClaudeSession, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_types ~w(decision insight code_change blocker)

  def changeset(fragment, attrs) do
    fragment
    |> cast(attrs, [:id, :session_id, :fragment_type, :content, :importance_score, :project_path])
    |> validate_required([:id, :fragment_type, :content])
    |> validate_inclusion(:fragment_type, @valid_types)
    |> validate_number(:importance_score, greater_than_or_equal_to: 0.0, less_than_or_equal_to: 1.0)
  end
end
