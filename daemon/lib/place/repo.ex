defmodule Place.Repo do
  use Ecto.Repo,
    otp_app: :place,
    adapter: Ecto.Adapters.SQLite3
end
