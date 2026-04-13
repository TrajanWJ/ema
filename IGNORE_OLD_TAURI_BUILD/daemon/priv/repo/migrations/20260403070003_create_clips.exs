defmodule Ema.Repo.Migrations.CreateClips do
  use Ecto.Migration

  def change do
    create table(:clips, primary_key: false) do
      add :id, :string, primary_key: true
      add :content, :text, null: false
      add :content_type, :string, null: false, default: "text"
      add :source_device, :string
      add :pinned, :boolean, default: false
      add :expires_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:clips, [:content_type])
    create index(:clips, [:pinned])
    create index(:clips, [:expires_at])
  end
end
