defmodule Ema.Babysitter.OrgController do
  @moduledoc """
  Discord organizational control — nudges, redirects, channel topic updates,
  and channel creation via the Discord REST API.
  """

  use GenServer
  require Logger

  @discord_api "https://discord.com/api/v10"
  @archive_category_id "1484014919904002170"

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Post a nudge message to `channel_id` via PubSub outbound."
  def nudge(channel_id, message) when is_binary(channel_id) and is_binary(message) do
    GenServer.cast(__MODULE__, {:nudge, channel_id, message})
  end

  @doc "Post a redirect message to `channel_id` via PubSub outbound."
  def redirect(channel_id, message) when is_binary(channel_id) and is_binary(message) do
    GenServer.cast(__MODULE__, {:redirect, channel_id, message})
  end

  @doc "PATCH the topic for a Discord channel."
  def set_channel_topic(channel_id, topic) when is_binary(channel_id) and is_binary(topic) do
    GenServer.call(__MODULE__, {:set_channel_topic, channel_id, topic})
  end

  @doc "Create a new Discord channel in `category_id` with the given name and topic."
  def create_channel(name, category_id, topic) do
    GenServer.call(__MODULE__, {:create_channel, name, category_id, topic})
  end

  @doc "Move a channel to a different category (parent_id)."
  def move_channel(channel_id, new_parent_id) when is_binary(channel_id) and is_binary(new_parent_id) do
    GenServer.call(__MODULE__, {:move_channel, channel_id, new_parent_id})
  end

  @doc "Archive a channel by moving it to the _ARCHIVE category."
  def archive_channel(channel_id) do
    move_channel(channel_id, @archive_category_id)
  end

  # --- GenServer ---

  @impl true
  def init(_opts) do
    {:ok, %{}}
  end

  @impl true
  def handle_cast({:nudge, channel_id, message}, state) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "discord:outbound:#{channel_id}",
      {:post, "💬 **Nudge:** #{message}"}
    )

    {:noreply, state}
  end

  def handle_cast({:redirect, channel_id, message}, state) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "discord:outbound:#{channel_id}",
      {:post, "↩️ **Redirect:** #{message}"}
    )

    {:noreply, state}
  end

  @impl true
  def handle_call({:set_channel_topic, channel_id, topic}, _from, state) do
    result = discord_patch("/channels/#{channel_id}", %{topic: topic})
    {:reply, result, state}
  end

  def handle_call({:create_channel, name, category_id, topic}, _from, state) do
    guild_id = System.get_env("DISCORD_GUILD_ID", "")

    body = %{
      name: name,
      type: 0,
      topic: topic,
      parent_id: category_id
    }

    result = discord_post("/guilds/#{guild_id}/channels", body)
    {:reply, result, state}
  end

  def handle_call({:move_channel, channel_id, new_parent_id}, _from, state) do
    result = discord_patch("/channels/#{channel_id}", %{parent_id: new_parent_id})
    {:reply, result, state}
  end

  # --- HTTP helpers ---

  defp discord_patch(path, body) do
    token = bot_token()

    case Req.patch(
           @discord_api <> path,
           json: body,
           headers: [{"Authorization", "Bot #{token}"}]
         ) do
      {:ok, %{status: status, body: resp_body}} when status in 200..299 ->
        {:ok, resp_body}

      {:ok, %{status: status, body: resp_body}} ->
        Logger.warning("[OrgController] Discord PATCH #{path} → #{status}: #{inspect(resp_body)}")
        {:error, {status, resp_body}}

      {:error, reason} ->
        Logger.error("[OrgController] Discord PATCH #{path} failed: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp discord_post(path, body) do
    token = bot_token()

    case Req.post(
           @discord_api <> path,
           json: body,
           headers: [{"Authorization", "Bot #{token}"}]
         ) do
      {:ok, %{status: status, body: resp_body}} when status in 200..299 ->
        {:ok, resp_body}

      {:ok, %{status: status, body: resp_body}} ->
        Logger.warning("[OrgController] Discord POST #{path} → #{status}: #{inspect(resp_body)}")
        {:error, {status, resp_body}}

      {:error, reason} ->
        Logger.error("[OrgController] Discord POST #{path} failed: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp bot_token do
    System.get_env("DISCORD_BOT_TOKEN") ||
      raise "DISCORD_BOT_TOKEN env var not set"
  end
end
