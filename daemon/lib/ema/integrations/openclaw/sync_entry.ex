defmodule Ema.Integrations.OpenClaw.SyncEntry do
  @moduledoc """
  Schema for tracking external vault sync state.
  Each row represents one file from a remote QMD vault, keyed by
  (integration, intent_node_id, source_host, source_root, relative_path).
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @valid_statuses ~w(pending synced error stale)

  schema "external_vault_sync_entries" do
    field :integration, :string
    field :intent_node_id, :string
    field :source_host, :string
    field :source_root, :string
    field :relative_path, :string
    field :source_checksum, :string
    field :source_mtime, :utc_datetime
    field :last_seen_at, :utc_datetime
    field :last_synced_at, :utc_datetime
    field :status, :string, default: "pending"
    field :last_error, :string
    field :vault_note_id, :string
    field :missing_count, :integer, default: 0

    timestamps(type: :utc_datetime)
  end

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [
      :id,
      :integration,
      :intent_node_id,
      :source_host,
      :source_root,
      :relative_path,
      :source_checksum,
      :source_mtime,
      :last_seen_at,
      :last_synced_at,
      :status,
      :last_error,
      :vault_note_id,
      :missing_count
    ])
    |> validate_required([:id, :integration, :intent_node_id, :source_host, :source_root, :relative_path])
    |> validate_inclusion(:status, @valid_statuses)
    |> unique_constraint(:relative_path, name: :external_vault_sync_entries_unique_path)
  end
end
