defmodule Ema.Actors.Bootstrap do
  @moduledoc false

  require Logger

  def ensure_defaults do
    case Ema.Actors.ensure_default_human_actor() do
      {:ok, _actor} -> :ok
      {:error, reason} -> Logger.warning("[Actors] failed to ensure human actor: #{inspect(reason)}")
    end
  end
end
