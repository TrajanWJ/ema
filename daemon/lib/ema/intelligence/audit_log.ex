defmodule Ema.Intelligence.AuditLog do
  @moduledoc "Schema for tracking agent governance events and actions."

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "audit_logs" do
    field :action, :string
    field :actor, :string
    field :resource, :string
    field :details, :map, default: %{}

    timestamps()
  end

  @doc "Changeset for creating an audit log entry."
  @spec changeset(%__MODULE__{}, map()) :: Ecto.Changeset.t()
  def changeset(log, attrs) do
    log
    |> cast(attrs, [:action, :actor, :resource, :details])
    |> validate_required([:action, :actor])
  end
end
