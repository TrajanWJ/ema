defmodule Ema.Clipboard do
  @moduledoc "Shared clipboard — synced clips across devices."

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Clipboard.Clip

  def list_clips do
    now = DateTime.utc_now()

    Clip
    |> where([c], is_nil(c.expires_at) or c.expires_at > ^now)
    |> order_by([c], [desc: c.pinned, desc: c.inserted_at])
    |> Repo.all()
  end

  def get_clip(id), do: Repo.get(Clip, id)

  def create_clip(attrs) do
    id = generate_id()

    %Clip{}
    |> Clip.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def update_clip(id, attrs) do
    case get_clip(id) do
      nil -> {:error, :not_found}
      clip -> clip |> Clip.changeset(attrs) |> Repo.update()
    end
  end

  def toggle_pin(id) do
    case get_clip(id) do
      nil -> {:error, :not_found}
      clip -> clip |> Ecto.Changeset.change(pinned: !clip.pinned) |> Repo.update()
    end
  end

  def delete_clip(id) do
    case get_clip(id) do
      nil -> {:error, :not_found}
      clip -> Repo.delete(clip)
    end
  end

  def cleanup_expired do
    now = DateTime.utc_now()

    Clip
    |> where([c], not is_nil(c.expires_at) and c.expires_at <= ^now)
    |> Repo.delete_all()
  end

  defp generate_id do
    ts = System.system_time(:millisecond) |> Integer.to_string()
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "clip_#{ts}_#{rand}"
  end
end
