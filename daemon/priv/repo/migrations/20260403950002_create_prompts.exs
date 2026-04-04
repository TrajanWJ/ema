defmodule Ema.Repo.Migrations.CreatePrompts do
  use Ecto.Migration

  def change do
    create table(:prompts, primary_key: false) do
      add :id,            :string,  primary_key: true
      add :version,       :integer, null: false, default: 1
      add :kind,          :string,  null: false
      add :content,       :text,    null: false
      add :a_b_test_group, :string
      add :metrics,       :text,    default: "{}"

      timestamps(type: :utc_datetime)
    end

    create index(:prompts, [:kind])
    create index(:prompts, [:version])
    create index(:prompts, [:a_b_test_group])
    create index(:prompts, [:kind, :version])
    create index(:prompts, [:inserted_at])
  end
end
