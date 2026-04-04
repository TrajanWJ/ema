defmodule Ema.Repo.Migrations.AddGitDiffToExecutions do
  use Ecto.Migration

  def change do
    alter table(:executions) do
      add :git_diff, :text, default: nil
    end
  end
end
