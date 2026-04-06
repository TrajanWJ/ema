defmodule Ema.Repo.Migrations.CreateConversationsAndMessages do
  use Ecto.Migration

  def change do
    create table(:messaging_conversations, primary_key: false) do
      add :id, :string, primary_key: true
      add :type, :string, null: false, default: "direct"
      add :name, :string
      add :participants, :text, default: "[]"

      timestamps(type: :utc_datetime)
    end

    create index(:messaging_conversations, [:type])

    create table(:messaging_messages, primary_key: false) do
      add :id, :string, primary_key: true
      add :conversation_id, references(:messaging_conversations, type: :string, on_delete: :delete_all), null: false
      add :sender_id, :string, null: false
      add :body, :text, null: false
      add :attachments, :text, default: "[]"
      add :reply_to_id, references(:messaging_messages, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:messaging_messages, [:conversation_id])
    create index(:messaging_messages, [:reply_to_id])
  end
end
