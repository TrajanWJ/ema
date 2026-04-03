defmodule Ema.Intelligence.GitEvent do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "git_events" do
    field :repo_path, :string
    field :commit_sha, :string
    field :author, :string
    field :message, :string
    field :changed_files, :map, default: %{}
    field :diff_summary, :string

    has_many :sync_actions, Ema.Intelligence.WikiSyncAction

    timestamps(type: :utc_datetime)
  end

  def changeset(event, attrs) do
    event
    |> cast(attrs, [:id, :repo_path, :commit_sha, :author, :message, :changed_files, :diff_summary])
    |> validate_required([:id, :repo_path, :commit_sha, :author, :message])
    |> unique_constraint(:commit_sha)
  end
end
