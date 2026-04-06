# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :ema,
  ecto_repos: [Ema.Repo],
  generators: [timestamp_type: :utc_datetime],
  # AI backend: :runner (legacy Claude CLI) or :bridge (multi-backend router)
  ai_backend: :bridge,
  # Manual by default during active construction to avoid SQLite contention on boot.
  start_startup_bootstrap: false,
  proposal_engine: [enabled: true],
  # Seed preflight quality gate: :observe | :enrich_only | :enforce
  seed_preflight: [mode: :enrich_only, minimum_score: 15, duplicate_similarity_threshold: 0.6],
  vault_path: System.get_env("EMA_VAULT_PATH", "/home/trajan/vault")

# Configure the endpoint
config :ema, EmaWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [json: EmaWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Ema.PubSub,
  live_view: [signing_salt: "C7j8xZUA"]

# Configure Elixir's Logger
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"

# MCP Server — disabled by default, enable in runtime.exs or dev.exs
config :ema, :mcp_server,
  enabled: false,
  port: 4001

# Distributed AI (off by default — enable in runtime.exs per node)
config :ema, :distributed_ai,
  enabled: false,
  cluster_strategy: :local

config :ema, Ema.Claude.ClusterConfig,
  strategy: :local,
  app_name: "ema"

config :libcluster,
  topologies: []
