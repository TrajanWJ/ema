defmodule Ema.Intents.Schematic.FeedItem do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @feed_types ~w(clarification hard_answer)
  @statuses ~w(open answered dismissed resolved)

  schema "schematic_feed_items" do
    field :feed_type, :string
    field :scope_path, :string
    field :title, :string
    field :context, :string
    field :options, :map, default: %{}
    field :status, :string, default: "open"
    field :selected, {:array, :string}, default: []
    field :user_response, :string
    field :chat_session_id, :string
    field :resolution, :string
    field :resolved_at, :utc_datetime

    belongs_to :target_intent, Ema.Intents.Intent, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :id,
      :feed_type,
      :scope_path,
      :target_intent_id,
      :title,
      :context,
      :options,
      :status,
      :selected,
      :user_response,
      :chat_session_id,
      :resolution,
      :resolved_at
    ])
    |> validate_required([:feed_type])
    |> validate_inclusion(:feed_type, @feed_types)
    |> validate_inclusion(:status, @statuses)
    |> maybe_generate_id()
  end

  defp maybe_generate_id(changeset) do
    case get_field(changeset, :id) do
      nil -> put_change(changeset, :id, new_id())
      _ -> changeset
    end
  end

  defp new_id do
    ts = System.system_time(:millisecond)
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "sfi_#{ts}_#{rand}"
  end
end
