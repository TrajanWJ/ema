defmodule Ema.Intelligence.ToolAtlasEntry do
  @moduledoc "Per-tool reliability stats stored in `tool_atlas`."

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "tool_atlas" do
    field :tool_name, :string
    field :total_calls, :integer, default: 0
    field :success_count, :integer, default: 0
    field :failure_count, :integer, default: 0
    field :failure_modes, :map, default: %{}
    field :avg_duration_ms, :integer
    field :last_called_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [
      :tool_name,
      :total_calls,
      :success_count,
      :failure_count,
      :failure_modes,
      :avg_duration_ms,
      :last_called_at
    ])
    |> validate_required([:tool_name])
    |> unique_constraint(:tool_name)
  end
end
