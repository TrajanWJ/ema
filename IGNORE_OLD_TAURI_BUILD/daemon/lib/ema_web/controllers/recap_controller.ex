defmodule EmaWeb.RecapController do
  use EmaWeb, :controller

  alias Ema.Intelligence.Recap

  def show(conn, params) do
    period =
      case params["period"] do
        p when p in ~w(today yesterday week month) -> String.to_existing_atom(p)
        _ -> :today
      end

    recap = Recap.generate(period: period)
    json(conn, recap)
  end
end
