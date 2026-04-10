defmodule Ema.Repo.Migrations.CreateToolAtlas do
  use Ecto.Migration

  def change do
    create table(:tool_atlas, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :tool_name, :string, null: false
      add :total_calls, :integer, default: 0, null: false
      add :success_count, :integer, default: 0, null: false
      add :failure_count, :integer, default: 0, null: false
      # %{rate_limit: 3, timeout: 1, auth_error: 0, parse_error: 0, unknown: 2}
      add :failure_modes, :map, default: %{}
      add :avg_duration_ms, :integer
      add :last_called_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create unique_index(:tool_atlas, [:tool_name])
  end
end
