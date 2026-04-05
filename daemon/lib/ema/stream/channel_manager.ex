defmodule Ema.Stream.ChannelManager do
  @moduledoc """
  Discord channel management via REST API.

  Provides create/archive/topic-set operations for Discord channels and categories.
  Used by babysitter logic when new work domains emerge or channels need managing.

  All operations require a guild ID, which is read from config or env:
    config :ema, discord_guild_id: "your_guild_id"
    DISCORD_GUILD_ID env var

  ## Usage

      # Create a text channel in a category
      ChannelManager.create_channel("new-domain", category_id: 12345678, topic: "Auto-created for domain X")

      # Create a category
      ChannelManager.create_category("New Domain")

      # Set channel topic
      ChannelManager.set_topic(channel_id, "Updated topic")

      # Archive a channel (move to archive category)
      ChannelManager.archive_channel(channel_id, archive_category_id: 99999)
  """

  require Logger

  @discord_api "https://discord.com/api/v10"

  # Discord channel types
  @type_text 0
  @type_category 4

  @type channel_opts :: [
    category_id: pos_integer() | nil,
    topic: String.t() | nil,
    position: non_neg_integer() | nil
  ]

  @doc """
  Create a text channel with the given name.

  Options:
    - `:category_id` — parent category ID
    - `:topic` — channel topic string
    - `:position` — channel position in sidebar
  """
  @spec create_channel(String.t(), channel_opts()) :: {:ok, map()} | {:error, term()}
  def create_channel(name, opts \\ []) do
    guild_id = guild_id!()
    url = "#{@discord_api}/guilds/#{guild_id}/channels"

    payload =
      %{"name" => sanitize_name(name), "type" => @type_text}
      |> maybe_put("parent_id", Keyword.get(opts, :category_id))
      |> maybe_put("topic", Keyword.get(opts, :topic))
      |> maybe_put("position", Keyword.get(opts, :position))

    case discord_post(url, payload) do
      {:ok, channel} ->
        Logger.info("[ChannelManager] Created channel ##{name} (id=#{channel["id"]})")
        {:ok, channel}

      {:error, reason} = err ->
        Logger.error("[ChannelManager] Failed to create channel #{name}: #{inspect(reason)}")
        err
    end
  end

  @doc """
  Create a category with the given name.
  """
  @spec create_category(String.t(), keyword()) :: {:ok, map()} | {:error, term()}
  def create_category(name, opts \\ []) do
    guild_id = guild_id!()
    url = "#{@discord_api}/guilds/#{guild_id}/channels"

    payload =
      %{"name" => sanitize_name(name), "type" => @type_category}
      |> maybe_put("position", Keyword.get(opts, :position))

    case discord_post(url, payload) do
      {:ok, category} ->
        Logger.info("[ChannelManager] Created category #{name} (id=#{category["id"]})")
        {:ok, category}

      err -> err
    end
  end

  @doc """
  Set the topic for a channel.
  """
  @spec set_topic(pos_integer() | String.t(), String.t()) :: {:ok, map()} | {:error, term()}
  def set_topic(channel_id, topic) when is_binary(topic) do
    url = "#{@discord_api}/channels/#{channel_id}"
    payload = %{"topic" => String.slice(topic, 0, 1024)}

    case discord_patch(url, payload) do
      {:ok, channel} ->
        Logger.info("[ChannelManager] Updated topic for #{channel_id}")
        {:ok, channel}

      err -> err
    end
  end

  @doc """
  Archive a channel by moving it to the given archive category.

  Options:
    - `:archive_category_id` — required: category to move to
    - `:lock` — if true, also marks channel read-only (default false)
  """
  @spec archive_channel(pos_integer() | String.t(), keyword()) :: {:ok, map()} | {:error, term()}
  def archive_channel(channel_id, opts \\ []) do
    archive_cat = Keyword.get(opts, :archive_category_id) ||
      Application.get_env(:ema, :discord_archive_category_id) ||
      System.get_env("DISCORD_ARCHIVE_CATEGORY_ID")

    if is_nil(archive_cat) do
      {:error, :no_archive_category}
    else
      url = "#{@discord_api}/channels/#{channel_id}"

      payload =
        %{"parent_id" => to_string(archive_cat)}
        |> then(fn p ->
          if Keyword.get(opts, :lock, false),
            do: Map.put(p, "permission_overwrites", []),
            else: p
        end)

      case discord_patch(url, payload) do
        {:ok, channel} ->
          Logger.info("[ChannelManager] Archived channel #{channel_id} → category #{archive_cat}")
          {:ok, channel}

        err -> err
      end
    end
  end

  @doc "List channels for the configured guild."
  @spec list_channels() :: {:ok, [map()]} | {:error, term()}
  def list_channels do
    guild_id = guild_id!()
    url = "#{@discord_api}/guilds/#{guild_id}/channels"
    discord_get(url)
  end

  # --- HTTP helpers ---

  defp discord_post(url, payload) do
    discord_request(:post, url, payload)
  end

  defp discord_patch(url, payload) do
    discord_request(:patch, url, payload)
  end

  defp discord_get(url) do
    token = discord_token!()

    case Req.get(url,
           headers: [{"authorization", "Bot #{token}"}]
         ) do
      {:ok, %{status: status, body: body}} when status in 200..204 ->
        {:ok, body}

      {:ok, %{status: status, body: body}} ->
        {:error, {:http_error, status, body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp discord_request(method, url, payload) do
    token = discord_token!()
    body = Jason.encode!(payload)

    req_fn = if method == :post, do: &Req.post/2, else: &Req.patch/2

    case req_fn.(url,
           body: body,
           headers: [
             {"authorization", "Bot #{token}"},
             {"content-type", "application/json"}
           ]
         ) do
      {:ok, %{status: status, body: body}} when status in 200..204 ->
        {:ok, body}

      {:ok, %{status: 429, body: body}} ->
        retry_after = get_in(body, ["retry_after"]) || 1.0
        Process.sleep(round(retry_after * 1000))
        discord_request(method, url, payload)

      {:ok, %{status: status, body: body}} ->
        {:error, {:http_error, status, body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp discord_token! do
    Application.get_env(:ema, :discord_bot_token) || System.get_env("DISCORD_BOT_TOKEN") ||
      raise "DISCORD_BOT_TOKEN not configured"
  end

  defp guild_id! do
    Application.get_env(:ema, :discord_guild_id) || System.get_env("DISCORD_GUILD_ID") ||
      raise "DISCORD_GUILD_ID not configured — set config :ema, discord_guild_id: \"...\""
  end

  defp sanitize_name(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\-_]/, "-")
    |> String.replace(~r/-+/, "-")
    |> String.trim("-")
    |> String.slice(0, 100)
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end
