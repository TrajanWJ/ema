defmodule Ema.Repo.Migrations.AddSourceFingerprintToProposals do
  use Ecto.Migration

  def change do
    alter table(:proposals) do
      add :source_fingerprint, :string
    end

    create unique_index(:proposals, [:source_fingerprint])
  end
end
