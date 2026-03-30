import Config

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
config :ema, Ema.Repo,
  database: Path.expand("~/.local/share/ema/ema_test.db"),
  pool_size: 5,
  pool: Ecto.Adapters.SQL.Sandbox

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :ema, EmaWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "3KN5JC6993F+dWmzrQ//vW/ej9yEgRtaSHhCAci2rJhVuQtDdhiHr+TYYjMy/51j",
  server: false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Sort query params output of verified routes for robust url comparisons
config :phoenix,
  sort_verified_routes_query_params: true

# Disable Second Brain OTP processes in tests (started manually when needed)
config :ema, start_second_brain: false

# Use a temp directory for vault in tests
config :ema, vault_root: Path.expand("../tmp/test_vault", __DIR__)

# Disable Pipes workers (Loader/Executor) — they need DB outside sandbox
config :ema, pipes_workers: false

# Disable OTP background workers in test (Responsibilities scheduler)
config :ema, start_otp_workers: false

# Disable Proposal Engine in test
config :ema, proposal_engine: [enabled: false]

# Disable Claude Sessions and Canvas supervisors in test
config :ema, start_claude_sessions: false
config :ema, start_canvas: false
