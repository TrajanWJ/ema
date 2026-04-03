defmodule Ema.Factory do
  @moduledoc """
  Test data factories for EMA.

  Import this module in tests:

      import Ema.Factory

      test "something" do
        task   = insert!(:task)
        task2  = insert!(:task, %{title: "Custom"})
        tasks  = insert_list!(3, :task)
      end
  """

  # ── Builders (attrs only, no DB) ──────────────────────────────────────

  def build(schema_atom, overrides \\ %{})

  def build(:task, overrides) do
    unique = System.unique_integer([:positive])
    Map.merge(%{
      title: "Test Task #{unique}",
      status: "inbox",
      priority: "medium",
      notes: nil,
      due_date: nil,
      project_id: nil
    }, overrides)
  end

  def build(:brain_dump, overrides) do
    unique = System.unique_integer([:positive])
    Map.merge(%{
      content: "Brain dump item #{unique}",
      source: "text",
      processed: false
    }, overrides)
  end

  def build(:project, overrides) do
    unique = System.unique_integer([:positive])
    slug = "test-project-#{unique}"
    Map.merge(%{
      name: "Test Project #{unique}",
      slug: slug,
      status: "active",
      description: "A test project"
    }, overrides)
  end

  def build(:habit, overrides) do
    unique = System.unique_integer([:positive])
    Map.merge(%{
      name: "Test Habit #{unique}",
      frequency: "daily",
      target: 1,
      active: true
    }, overrides)
  end

  def build(:responsibility, overrides) do
    unique = System.unique_integer([:positive])
    Map.merge(%{
      name: "Test Responsibility #{unique}",
      description: "Does something important",
      frequency: "weekly"
    }, overrides)
  end

  def build(:proposal, overrides) do
    unique = System.unique_integer([:positive])
    Map.merge(%{
      title: "Test Proposal #{unique}",
      body: "This proposal suggests something useful",
      status: "pending",
      source: "manual"
    }, overrides)
  end

  def build(:note, overrides) do
    unique = System.unique_integer([:positive])
    Map.merge(%{
      title: "Test Note #{unique}",
      content: "Note content here",
      tags: []
    }, overrides)
  end

  def build(:ai_session, overrides) do
    unique = System.unique_integer([:positive])
    Map.merge(%{
      id: "ais_test_#{unique}",
      model: "sonnet",
      status: "active",
      title: "Test Session #{unique}",
      project_path: "/tmp/test/project-#{unique}",
      metadata: %{}
    }, overrides)
  end

  def build(:dcc, overrides) do
    unique = System.unique_integer([:positive])
    Map.merge(%{
      session_id: "dcc_test_#{unique}",
      project_id: "project-#{unique}",
      active_task_ids: [],
      decision_hashes: [],
      intent_snapshot: %{},
      proposal_context: %{},
      session_narrative: nil,
      metadata: %{}
    }, overrides)
  end

  # ── Insert helpers ────────────────────────────────────────────────────

  def insert!(schema_atom, overrides \\ %{})

  def insert!(:journal_entry, _overrides) do
    date = Date.utc_today()
    case Ema.Journal.create_entry(date) do
      {:ok, entry} -> entry
      {:error, reason} -> raise "Factory insert! failed for journal_entry: #{inspect(reason)}"
    end
  end

  def insert!(:ai_session, overrides) do
    attrs = build(:ai_session, overrides)
    case %Ema.Claude.AiSession{} |> Ema.Claude.AiSession.changeset(attrs) |> Ema.Repo.insert() do
      {:ok, record} -> record
      {:error, changeset} -> raise "Factory insert! failed for ai_session: #{inspect(changeset.errors)}"
    end
  end

  def insert!(:dcc, overrides) do
    attrs = build(:dcc, overrides)
    Ema.Core.DccPrimitive.new(attrs)
  end

  def insert!(schema_atom, overrides) do
    attrs = build(schema_atom, overrides)
    {context_mod, create_fn} = context_for(schema_atom)
    case apply(context_mod, create_fn, [attrs]) do
      {:ok, record} ->
        record
      {:error, changeset} ->
        raise "Factory insert! failed for #{schema_atom}: #{inspect(changeset.errors)}"
    end
  end

  def insert_list!(n, schema_atom, overrides \\ %{}) do
    for _ <- 1..n, do: insert!(schema_atom, overrides)
  end

  # ── Context mapping ───────────────────────────────────────────────────

  defp context_for(:task),           do: {Ema.Tasks, :create_task}
  defp context_for(:brain_dump),     do: {Ema.BrainDump, :create_item}
  defp context_for(:project),        do: {Ema.Projects, :create_project}
  defp context_for(:habit),          do: {Ema.Habits, :create_habit}
  defp context_for(:responsibility), do: {Ema.Responsibilities, :create_responsibility}
  defp context_for(:proposal),       do: {Ema.Proposals, :create_proposal}
  defp context_for(:note),           do: {Ema.Notes, :create_note}
  defp context_for(other),           do: raise "No factory registered for #{inspect(other)}"
end
