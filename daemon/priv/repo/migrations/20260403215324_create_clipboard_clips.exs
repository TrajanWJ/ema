defmodule Ema.Repo.Migrations.CreateClipboardClips do
  use Ecto.Migration

  def change do
    create table(:clipboard_clips, primary_key: false) do
      add :id, :string, primary_key: true
      add :content, :text, null: false
      add :content_type, :string, default: "text"
      add :source, :string, default: "manual"
      add :pinned, :boolean, default: false
      add :expires_at, :utc_datetime
      timestamps(type: :utc_datetime)
    end
  end
end
