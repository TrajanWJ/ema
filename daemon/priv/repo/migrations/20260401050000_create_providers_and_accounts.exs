defmodule Ema.Repo.Migrations.CreateProvidersAndAccounts do
  @moduledoc """
  Creates providers and accounts tables for the multi-backend system.

  Providers track the AI backends (Claude CLI, Codex, Ollama, OpenRouter, etc.)
  along with their status, capabilities, and cost profiles.

  Accounts track authentication credentials per provider, with rate limit
  state, usage statistics, and priority for automatic rotation.
  """

  use Ecto.Migration

  def change do
    # ── Providers table ──────────────────────────────────────────────────────

    create table(:claude_providers, primary_key: false) do
      add :id, :string, primary_key: true
      add :type, :string, null: false
      add :name, :string, null: false
      add :status, :string, null: false, default: "available"

      # JSON columns for flexible nested data
      add :config, :map, default: %{}

      add :capabilities, :map,
        default: %{
          "streaming" => false,
          "code_execution" => false,
          "tool_use" => false,
          "file_access" => false,
          "web_search" => false,
          "models" => []
        }

      add :cost_profile, :map, default: %{}

      add :rate_limits, :map,
        default: %{
          "requests_per_min" => nil,
          "tokens_per_min" => nil
        }

      add :health, :map,
        default: %{
          "last_check" => nil,
          "latency_ms" => nil,
          "error_rate" => 0.0,
          "consecutive_failures" => 0
        }

      timestamps(type: :utc_datetime_usec)
    end

    create index(:claude_providers, [:type])
    create index(:claude_providers, [:status])

    # ── Accounts table ───────────────────────────────────────────────────────

    create table(:claude_accounts, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :provider_id, references(:claude_providers, type: :string, on_delete: :delete_all),
        null: false

      add :name, :string, null: false
      # "oauth", "api_key", "system"
      add :auth_type, :string, null: false

      # Don't store actual credentials in DB — just the type and reference path
      # e.g. "~/.claude/credentials.json" or env var name
      add :auth_reference, :string

      add :status, :string, null: false, default: "available"
      add :priority, :integer, null: false, default: 10

      add :rate_limit_state, :map,
        default: %{
          "remaining" => nil,
          "limit" => nil,
          "reset_at" => nil,
          "last_limited_at" => nil
        }

      add :usage_today, :map,
        default: %{
          "date" => nil,
          "requests" => 0,
          "input_tokens" => 0,
          "output_tokens" => 0,
          "cost_usd" => 0.0
        }

      add :usage_lifetime, :map,
        default: %{
          "requests" => 0,
          "input_tokens" => 0,
          "output_tokens" => 0,
          "cost_usd" => 0.0
        }

      add :health, :map,
        default: %{
          "error_count" => 0,
          "last_error_at" => nil,
          "last_success_at" => nil,
          "consecutive_errors" => 0
        }

      add :metadata, :map, default: %{}

      timestamps(type: :utc_datetime_usec)
    end

    create index(:claude_accounts, [:provider_id])
    create index(:claude_accounts, [:status])
    create index(:claude_accounts, [:priority])

    create unique_index(:claude_accounts, [:provider_id, :name],
             name: :claude_accounts_provider_name_idx
           )
  end
end
