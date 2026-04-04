defmodule Ema.Repo.Migrations.AddGithubFieldsToProjects do
  use Ecto.Migration

  def change do
    alter table(:projects) do
      add :github_repo_url, :string
      add :last_commit_sha, :string
    end
  end
end
