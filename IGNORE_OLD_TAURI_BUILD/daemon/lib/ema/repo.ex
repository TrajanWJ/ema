defmodule Ema.Repo do
  use Ecto.Repo,
    otp_app: :ema,
    adapter: Ecto.Adapters.SQLite3
end
