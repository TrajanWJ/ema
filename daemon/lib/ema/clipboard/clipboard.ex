defmodule Ema.Clipboard do
  @moduledoc """
  Shared Clipboard — cross-device clipboard with pinning and expiry.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Clipboard.Clip

  def list_clips(opts \\ []) do
    query =
      Clip
      |> order_by(desc: :inserted_at)

    query =
      case Keyword.get(opts, :content_type) do
        nil -> query
        ct -> where(query, [c], c.content_type == ^ct)
      end

    query =
      case Keyword.get(opts, :pinned) do
        nil -> query
        pinned -> where(query, [c], c.pinned == ^pinned)
      end

    Repo.all(query)
  end

  def get_clip(id), do: Repo.get(Clip, id)

  def get_clip!(id), do: Repo.get!(Clip, id)

  def create_clip(attrs) do
    id = generate_id("clip")

    %Clip{}
    |> Clip.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
    |> tap_broadcast(:clip_created)
  end

  def delete_clip(id) do
    case get_clip(id) do
      nil -> {:error, :not_found}
      clip -> Repo.delete(clip) |> tap_broadcast(:clip_deleted)
    end
  end

  def pin(id) do
    case get_clip(id) do
      nil -> {:error, :not_found}

      clip ->
        clip
        |> Clip.changeset(%{pinned: true})
        |> Repo.update()
        |> tap_broadcast(:clip_pinned)
    end
  end

  def unpin(id) do
    case get_clip(id) do
      nil -> {:error, :not_found}

      clip ->
        clip
        |> Clip.changeset(%{pinned: false})
        |> Repo.update()
        |> tap_broadcast(:clip_unpinned)
    end
  end

  def cleanup_expired do
    now = DateTime.utc_now()

    {count, _} =
      Clip
      |> where([c], not is_nil(c.expires_at) and c.expires_at < ^now)
      |> where([c], c.pinned == false)
      |> Repo.delete_all()

    {:ok, count}
  end

  defp tap_broadcast(result, event) do
    case result do
      {:ok, record} ->
        Phoenix.PubSub.broadcast(Ema.PubSub, "clipboard:updates", {event, record})
        {:ok, record}

      error ->
        error
    end
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
