defmodule Ema.Intelligence.WikiSyncAction do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "wiki_sync_actions" do
    field :action_type, :string
    field :wiki_path, :string
    field :suggestion, :string
    field :auto_applied, :boolean, default: false

    belongs_to :git_event, Ema.Intelligence.GitEvent, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(action, attrs) do
    action
    |> cast(attrs, [:id, :git_event_id, :action_type, :wiki_path, :suggestion, :auto_applied])
    |> validate_required([:id, :git_event_id, :action_type, :wiki_path, :suggestion])
    |> validate_inclusion(:action_type, ~w(create_stub flag_outdated update_content))
  end
end
