defmodule Ema.Repo.Migrations.CreateRoutingDecisions do
  @moduledoc """
  Creates the routing_decisions table for recording and learning from
  routing outcomes.

  Every AI request that goes through SmartRouter gets a record here.
  Over time, this data enables the router to learn which provider/model
  combinations work best for which task types — reinforcement from
  real-world outcomes rather than just heuristics.

  ## Usage Analysis

  Useful queries on this table:
  - Average latency per provider per task type
  - Success rate per provider per model
  - Cost breakdown by task type over time
  - Which models are chosen most often (and whether they succeed)
  - Identify providers that consistently fail for certain tasks
  """

  use Ecto.Migration

  def change do
    create table(:claude_routing_decisions, primary_key: false) do
      add :id, :binary_id, primary_key: true

      # What was requested
      add :task_type, :string, null: false
      # SHA-256 of first 500 chars (for dedup/grouping, not full prompt)
      add :prompt_hash, :string
      add :prompt_length, :integer
      add :strategy, :string, null: false

      # Where it was routed
      add :provider_id, references(:claude_providers, type: :string, on_delete: :nilify_all)
      add :account_id, references(:claude_accounts, type: :binary_id, on_delete: :nilify_all)
      add :model, :string, null: false

      # Outcome metrics
      # Total time from route decision to completion
      add :latency_ms, :integer
      # Streaming: when first token arrived
      add :time_to_first_token_ms, :integer
      add :input_tokens, :integer
      add :output_tokens, :integer
      add :total_tokens, :integer
      # High precision for micro-costs
      add :cost_usd, :decimal, precision: 12, scale: 8

      # Success tracking
      add :success, :boolean, null: false, default: true
      # If failed: the error code/type
      add :error_code, :string
      # If failed: truncated error message
      add :error_message, :string

      # Failover tracking
      add :was_failover, :boolean, null: false, default: false
      # Which provider failed before this one
      add :failover_from_provider_id, :string
      # Why the previous provider failed
      add :failover_reason, :string

      # Quality signals (optional, populated by downstream evaluation)
      # 0.0-1.0 if evaluated
      add :quality_score, :float
      # "good", "bad", "regenerated"
      add :user_feedback, :string

      # Node coordination
      # Which Erlang node executed this
      add :executed_on_node, :string
      add :was_remote, :boolean, null: false, default: false

      add :inserted_at, :utc_datetime_usec, null: false
    end

    # Performance indexes for common queries
    create index(:claude_routing_decisions, [:task_type])
    create index(:claude_routing_decisions, [:provider_id])
    create index(:claude_routing_decisions, [:model])
    create index(:claude_routing_decisions, [:success])
    create index(:claude_routing_decisions, [:inserted_at])

    # Composite indexes for analytics
    create index(:claude_routing_decisions, [:task_type, :provider_id, :success],
             name: :routing_task_provider_success_idx
           )

    create index(:claude_routing_decisions, [:provider_id, :model, :inserted_at],
             name: :routing_provider_model_time_idx
           )

    create index(:claude_routing_decisions, [:strategy, :inserted_at],
             name: :routing_strategy_time_idx
           )

    # Partial index for failures only (for quick error analysis)
    create index(:claude_routing_decisions, [:provider_id, :error_code, :inserted_at],
             where: "success = false",
             name: :routing_failures_idx
           )
  end
end
