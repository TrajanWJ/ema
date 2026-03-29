defmodule Ema.Journal.Entry do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "journal_entries" do
    field :date, :string
    field :content, :string, default: ""
    field :one_thing, :string
    field :mood, :integer
    field :energy_p, :integer
    field :energy_m, :integer
    field :energy_e, :integer
    field :gratitude, :string
    field :tags, :string

    timestamps(type: :utc_datetime)
  end

  @default_template """
  ## Today's Focus


  ## Notes


  ## Ideas


  ## Gratitude
  1.
  2.
  3.

  ## Reflection

  """

  def default_template, do: @default_template

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [:id, :date, :content, :one_thing, :mood, :energy_p, :energy_m, :energy_e, :gratitude, :tags])
    |> validate_required([:id, :date])
    |> validate_inclusion(:mood, 1..5)
    |> validate_inclusion(:energy_p, 1..10)
    |> validate_inclusion(:energy_m, 1..10)
    |> validate_inclusion(:energy_e, 1..10)
    |> unique_constraint(:date)
  end
end
