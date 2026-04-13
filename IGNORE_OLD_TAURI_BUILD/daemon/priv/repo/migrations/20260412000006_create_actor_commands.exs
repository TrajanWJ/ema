defmodule Ema.Repo.Migrations.CreateActorCommands do
  use Ecto.Migration

  def change do
    create table(:actor_commands, primary_key: false) do
      add :id, :string, primary_key: true
      add :actor_id, references(:actors, type: :string, on_delete: :delete_all), null: false
      add :command_name, :string, null: false
      add :description, :string
      add :handler_module, :string, null: false
      add :handler_function, :string, null: false
      add :args_spec, :map, default: %{}

      timestamps(type: :utc_datetime)
    end

    create unique_index(:actor_commands, [:actor_id, :command_name])
  end
end
