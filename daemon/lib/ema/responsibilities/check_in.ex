defmodule Ema.Responsibilities.CheckIn do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "responsibility_check_ins" do
    field :status, :string
    field :note, :string

    belongs_to :responsibility, Ema.Responsibilities.Responsibility, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(healthy at_risk failing)

  def changeset(check_in, attrs) do
    check_in
    |> cast(attrs, [:id, :status, :note, :responsibility_id])
    |> validate_required([:id, :status, :responsibility_id])
    |> validate_inclusion(:status, @valid_statuses)
  end
end
