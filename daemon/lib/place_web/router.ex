defmodule PlaceWeb.Router do
  use PlaceWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", PlaceWeb do
    pipe_through :api
  end
end
