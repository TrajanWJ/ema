defmodule Ema.Repo.Migrations.CreateAiSessions do
  use Ecto.Migration

  def change do
    create table(:ai_sessions, primary_key: false) do
      add :id, :string, primary_key: true
      add :model, :string, null: false, default: "sonnet"
      add :status, :string, null: false, default: "active"
      add :message_count, :integer, null: false, default: 0
      add :total_input_tokens, :integer, null: false, default: 0
      add :total_output_tokens, :integer, null: false, default: 0
      add :cost_usd, :float, null: false, default: 0.0
      add :title, :string
      add :project_path, :string
      add :parent_session_id, :string
      add :fork_point_message_id, :string
      add :agent_id, :string
      add :metadata, :map, default: %{}

      timestamps(type: :utc_datetime)
    end

    create index(:ai_sessions, [:status])
    create index(:ai_sessions, [:agent_id])
    create index(:ai_sessions, [:parent_session_id])

    create table(:ai_session_messages, primary_key: false) do
      add :id, :string, primary_key: true

      add :session_id, references(:ai_sessions, type: :string, on_delete: :delete_all),
        null: false

      add :role, :string, null: false
      add :content, :text
      add :token_count, :integer, default: 0
      add :tool_calls, :map, default: %{}
      add :metadata, :map, default: %{}

      timestamps(type: :utc_datetime)
    end

    create index(:ai_session_messages, [:session_id])
  end
end
