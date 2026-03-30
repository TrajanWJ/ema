defmodule Ema.Repo.Migrations.RecreateAgents do
  use Ecto.Migration

  def change do
    # Drop old agent tables
    drop_if_exists index(:agent_runs, [:template_id])
    drop_if_exists index(:agent_runs, [:status])
    drop_if_exists table(:agent_runs)
    drop_if_exists table(:agent_templates)

    create table(:agents, primary_key: false) do
      add :id, :string, primary_key: true
      add :slug, :string, null: false
      add :name, :string, null: false
      add :description, :text
      add :avatar, :string
      add :status, :string, default: "inactive"
      add :model, :string
      add :temperature, :float
      add :max_tokens, :integer
      add :script_path, :string
      add :tools, :text, default: "[]"
      add :settings, :text, default: "{}"
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create unique_index(:agents, [:slug])
    create index(:agents, [:project_id])
    create index(:agents, [:status])

    create table(:agent_runs, primary_key: false) do
      add :id, :string, primary_key: true
      add :project_path, :string
      add :status, :string, default: "pending"
      add :started_at, :utc_datetime
      add :output_path, :string
      add :exit_code, :integer
      add :agent_id, references(:agents, type: :string, on_delete: :nilify_all)
      add :task_id, references(:tasks, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:agent_runs, [:agent_id])
    create index(:agent_runs, [:task_id])
    create index(:agent_runs, [:status])

    create table(:agent_channels, primary_key: false) do
      add :id, :string, primary_key: true
      add :channel_type, :string, null: false
      add :active, :boolean, default: true
      add :config, :text, default: "{}"
      add :status, :string, default: "disconnected"
      add :last_connected_at, :utc_datetime
      add :error_message, :text
      add :agent_id, references(:agents, type: :string, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:agent_channels, [:agent_id])

    create table(:agent_conversations, primary_key: false) do
      add :id, :string, primary_key: true
      add :channel_type, :string
      add :channel_id, :string
      add :external_user_id, :string
      add :status, :string, default: "active"
      add :metadata, :text, default: "{}"
      add :agent_id, references(:agents, type: :string, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:agent_conversations, [:agent_id])
    create index(:agent_conversations, [:status])

    create table(:agent_messages, primary_key: false) do
      add :id, :string, primary_key: true
      add :role, :string, null: false
      add :content, :text
      add :tool_calls, :text, default: "[]"
      add :token_count, :integer
      add :metadata, :text, default: "{}"
      add :conversation_id, references(:agent_conversations, type: :string, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:agent_messages, [:conversation_id])
  end
end
