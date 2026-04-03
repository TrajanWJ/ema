defmodule Ema.Intelligence.UsageRecord do
  @moduledoc "Schema for tracking AI bridge usage per request."

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "usage_records" do
    field :agent_id, :string
    field :task_type, :string
    field :model, :string
    field :tokens_in, :integer, default: 0
    field :tokens_out, :integer, default: 0
    field :cost_usd, :decimal, default: Decimal.new("0.00")
    field :metadata, :map, default: %{}

    timestamps()
  end

  @doc "Changeset for creating a usage record."
  @spec changeset(%__MODULE__{}, map()) :: Ecto.Changeset.t()
  def changeset(record, attrs) do
    record
    |> cast(attrs, [
      :agent_id,
      :task_type,
      :model,
      :tokens_in,
      :tokens_out,
      :cost_usd,
      :metadata
    ])
    |> validate_required([:agent_id, :task_type, :model])
  end
end
