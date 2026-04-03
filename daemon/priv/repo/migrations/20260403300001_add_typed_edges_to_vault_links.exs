defmodule Ema.Repo.Migrations.AddTypedEdgesToVaultLinks do
  use Ecto.Migration

  def change do
    alter table(:vault_links) do
      add :edge_type, :string, default: "references"
      add :metadata, :string
    end
  end
end
