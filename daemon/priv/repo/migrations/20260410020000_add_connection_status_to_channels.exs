defmodule Ema.Repo.Migrations.AddConnectionStatusToChannels do
  use Ecto.Migration

  def change do
    alter table(:agent_channels) do
      add :connection_status, :string, default: "disconnected", null: false
    end

    # Backfill from existing :status column
    execute(
      "UPDATE agent_channels SET connection_status = status WHERE connection_status = 'disconnected'",
      "SELECT 1"
    )
  end
end
