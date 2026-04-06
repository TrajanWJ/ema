import Config

claude_runtime = Ema.Claude.RuntimeBootstrap.build()

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.
# The block below contains prod specific runtime configuration.

# ## Using releases
#
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#
#     PHX_SERVER=true bin/daemon start
#
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :ema, EmaWeb.Endpoint, server: true
end

config :ema, EmaWeb.Endpoint, http: [port: String.to_integer(System.get_env("PORT", "4488"))]

# Discord bot — used by Babysitter StreamChannels, Feedback.Broadcast, OrgController
if discord_token = System.get_env("DISCORD_BOT_TOKEN") do
  config :ema, :discord_bot_token, discord_token
end

# OpenClaw agent gateway (local-first, no VM dependency)
config :ema, :openclaw,
  gateway_url: System.get_env("OPENCLAW_GATEWAY_URL", "http://localhost:18789"),
  default_agent: System.get_env("OPENCLAW_DEFAULT_AGENT", "main"),
  timeout: String.to_integer(System.get_env("OPENCLAW_TIMEOUT", "120"))

config :ema, Ema.Claude,
  default_strategy: :balanced,
  providers: claude_runtime.providers,
  distribution: claude_runtime.distribution

config :ema, :accounts, claude_runtime.accounts

config :ema, :distributed_ai,
  enabled: Keyword.get(claude_runtime.distribution, :enabled, false),
  cluster_strategy: Keyword.get(claude_runtime.distribution, :cluster_strategy, :local)

# OpenClaw vault sync — one-way rsync from QMD vault on agent-vm
config :ema, :openclaw_vault_sync,
  enabled: System.get_env("OPENCLAW_VAULT_SYNC", "false") == "true",
  source_host: System.get_env("OPENCLAW_VAULT_HOST", "192.168.122.10"),
  source_root:
    System.get_env(
      "OPENCLAW_VAULT_ROOT",
      "projects/openclaw/intents/int_1775263900943_1678626d"
    ),
  intent_node_id: System.get_env("OPENCLAW_VAULT_INTENT", "int_1775263900943_1678626d"),
  interval: String.to_integer(System.get_env("OPENCLAW_VAULT_INTERVAL", "30000")),
  reconcile_interval: String.to_integer(System.get_env("OPENCLAW_VAULT_RECONCILE", "900000"))

# Git repositories to watch for wiki sync
config :ema,
       :git_watch_paths,
       String.split(
         System.get_env(
           "GIT_WATCH_PATHS",
           "#{Path.expand("~/Projects/ema")},#{Path.expand("~/Desktop/place.org")},#{Path.expand("~/Desktop/JarvisAI")}"
         ),
         ","
       )
       |> Enum.map(&String.trim/1)
       |> Enum.filter(&(String.length(&1) > 0))

if config_env() == :prod do
  config :ema, Ema.Repo,
    database: System.get_env("DATABASE_PATH") || Path.expand("~/.local/share/ema/ema.db"),
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "5")

  # The secret key base is used to sign/encrypt cookies and other secrets.
  # A default value is used in config/dev.exs and config/test.exs but you
  # want to use a different value for prod and you most likely don't want
  # to check this value into version control, so we use an environment
  # variable instead.
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host = System.get_env("PHX_HOST") || "example.com"

  config :ema, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  config :ema, EmaWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      # Enable IPv6 and bind on all interfaces.
      # Set it to  {0, 0, 0, 0, 0, 0, 0, 1} for local network only access.
      # See the documentation on https://hexdocs.pm/bandit/Bandit.html#t:options/0
      # for details about using IPv6 vs IPv4 and loopback vs public addresses.
      ip: {0, 0, 0, 0, 0, 0, 0, 0}
    ],
    secret_key_base: secret_key_base

  # ## SSL Support
  #
  # To get SSL working, you will need to add the `https` key
  # to your endpoint configuration:
  #
  #     config :ema, EmaWeb.Endpoint,
  #       https: [
  #         ...,
  #         port: 443,
  #         cipher_suite: :strong,
  #         keyfile: System.get_env("SOME_APP_SSL_KEY_PATH"),
  #         certfile: System.get_env("SOME_APP_SSL_CERT_PATH")
  #       ]
  #
  # The `cipher_suite` is set to `:strong` to support only the
  # latest and more secure SSL ciphers. This means old browsers
  # and clients may not be supported. You can set it to
  # `:compatible` for wider support.
  #
  # `:keyfile` and `:certfile` expect an absolute path to the key
  # and cert in disk or a relative path inside priv, for example
  # "priv/ssl/server.key". For all supported SSL configuration
  # options, see https://hexdocs.pm/plug/Plug.SSL.html#configure/1
  #
  # We also recommend setting `force_ssl` in your config/prod.exs,
  # ensuring no data is ever sent via http, always redirecting to https:
  #
  #     config :ema, EmaWeb.Endpoint,
  #       force_ssl: [hsts: true]
  #
  # Check `Plug.SSL` for all available options in `force_ssl`.
end

# ── Anthropic Direct API Key (preferred over OAuth when ANTHROPIC_API_KEY is set) ──
if api_key = System.get_env("ANTHROPIC_API_KEY") do
  config :ema, anthropic_api_key: api_key

  existing_claude_config = Application.get_env(:ema, Ema.Claude, [])
  existing_providers = Keyword.get(existing_claude_config, :providers, [])

  anthropic_api_key_provider = %{
    id: "anthropic-api-key",
    type: :anthropic,
    name: "Anthropic Direct API",
    adapter_module: Ema.Claude.Adapters.ApiKey,
    accounts: [%{name: "default", auth: {:api_key, {:env, "ANTHROPIC_API_KEY"}}}],
    models: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
    cost_profile: %{
      "claude-opus-4-6": %{input_per_1k: 0.015, output_per_1k: 0.075},
      "claude-sonnet-4-6": %{input_per_1k: 0.003, output_per_1k: 0.015},
      "claude-haiku-4-5-20251001": %{input_per_1k: 0.0008, output_per_1k: 0.004}
    },
    capabilities: %{
      streaming: true,
      tool_use: true,
      multi_turn: false
    }
  }

  config :ema,
         Ema.Claude,
         Keyword.put(existing_claude_config, :providers, [
           anthropic_api_key_provider | existing_providers
         ])
end
