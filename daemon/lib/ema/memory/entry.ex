defmodule Ema.Memory.Entry do
  @moduledoc """
  Sugar-style typed memory entry — persistent context that survives across
  Claude/agent sessions.

  Each entry has:
    - a `memory_type` from the closed taxonomy below
    - a `scope` (project / space / actor / global)
    - free-form `content` (full body) and optional `summary` (one-liner)
    - an `importance` weight 0.0–1.0 used by the retriever
    - access bookkeeping (`access_count`, `last_accessed_at`) so hot
      entries can be surfaced first
    - optional FK links to actor / space / project so the same store
      can serve every container

  Backed by `memory_entries` + an FTS5 virtual table (`memory_fts`) kept
  in sync via SQLite triggers (see migration 20260413000005).
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @memory_types ~w(decision preference file_context error_pattern research outcome guideline)
  @scopes ~w(project global actor space)

  schema "memory_entries" do
    field :memory_type, :string
    field :scope, :string, default: "project"
    field :source_id, :string
    field :content, :string
    field :summary, :string
    field :metadata, :map, default: %{}
    field :importance, :float, default: 1.0
    field :access_count, :integer, default: 0
    field :last_accessed_at, :utc_datetime
    field :expires_at, :utc_datetime

    belongs_to :actor, Ema.Actors.Actor, type: :string
    belongs_to :space, Ema.Spaces.Space, type: :string
    belongs_to :project, Ema.Projects.Project, type: :string

    timestamps(type: :utc_datetime)
  end

  def memory_types, do: @memory_types
  def scopes, do: @scopes

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [
      :id,
      :memory_type,
      :scope,
      :actor_id,
      :space_id,
      :project_id,
      :source_id,
      :content,
      :summary,
      :metadata,
      :importance,
      :access_count,
      :last_accessed_at,
      :expires_at
    ])
    |> validate_required([:id, :memory_type, :content])
    |> validate_inclusion(:memory_type, @memory_types)
    |> validate_inclusion(:scope, @scopes)
    |> validate_number(:importance, greater_than_or_equal_to: 0.0, less_than_or_equal_to: 1.0)
  end
end
