defmodule Ema.Intelligence.SupermanContinuityHookTest do
  use Ema.DataCase, async: false

  alias Ema.Intelligence.SupermanContinuityHook
  alias Ema.Claude.SessionManager
  alias Ema.Core.DccPrimitive
  alias Ema.Persistence.SessionStore

  import Ema.Factory

  setup do
    # Start SessionStore and SessionManager (disabled in test config)
    start_supervised!(SessionStore)
    start_supervised!(SessionManager)
    :ok
  end

  defp create_ai_session(overrides \\ %{}) do
    attrs = build(:ai_session, overrides)
    {:ok, session} = SessionManager.create_session(attrs)
    session
  end

  describe "before_call/2" do
    test "enriches opts with session context" do
      session = create_ai_session()

      # Add a message so context has content
      SessionManager.add_message(session.id, "user", "Fix the auth bug")

      opts = %{instruction: "fix auth"}
      enriched = SupermanContinuityHook.before_call(session.id, opts)

      assert Map.has_key?(enriched, :session_context)
      assert enriched.session_context.session_id == session.id
      assert enriched.session_context.model == "sonnet"
      assert is_list(enriched.session_context.recent_messages)
      # Original opts preserved
      assert enriched.instruction == "fix auth"
    end

    test "includes DCC snapshot when available" do
      session = create_ai_session()

      dcc =
        DccPrimitive.new(%{session_id: session.id, project_id: "proj_1"})
        |> DccPrimitive.with_tasks(["t1"])

      SessionStore.store(session.id, dcc)

      enriched = SupermanContinuityHook.before_call(session.id, %{})
      assert enriched.session_context.dcc != nil
      assert enriched.session_context.dcc[:session_id] == session.id
    end

    test "handles nil session_id gracefully" do
      opts = %{instruction: "do something"}
      assert SupermanContinuityHook.before_call(nil, opts) == opts
    end

    test "handles nonexistent session" do
      enriched = SupermanContinuityHook.before_call("nonexistent", %{})
      assert enriched.session_context.error == :not_found
    end
  end

  describe "after_call/2" do
    test "imports tool_calls as session messages" do
      session = create_ai_session()

      superman_result =
        {:ok,
         %{
           "tool_calls" => [
             %{
               "name" => "Edit",
               "description" => "Fixed auth module",
               "files" => ["lib/auth.ex"]
             },
             %{
               "name" => "Write",
               "description" => "Created test file",
               "files" => ["test/auth_test.exs"]
             }
           ]
         }}

      assert :ok = SupermanContinuityHook.after_call(session.id, superman_result)

      # Verify messages were added
      {:ok, %{messages: messages}} = SessionManager.get_session(session.id)
      tool_messages = Enum.filter(messages, &(&1.role == "tool"))
      assert length(tool_messages) == 2
      assert hd(tool_messages).content == "Fixed auth module"
    end

    test "handles changes format from apply_task" do
      session = create_ai_session()

      superman_result =
        {:ok,
         %{
           "changes" => [
             %{"file" => "lib/auth.ex", "description" => "Updated login flow"},
             %{"path" => "lib/session.ex", "description" => "Added session tracking"}
           ]
         }}

      assert :ok = SupermanContinuityHook.after_call(session.id, superman_result)

      {:ok, %{messages: messages}} = SessionManager.get_session(session.id)
      tool_messages = Enum.filter(messages, &(&1.role == "tool"))
      assert length(tool_messages) == 2
    end

    test "updates DCC metadata with superman call info" do
      session = create_ai_session()
      dcc = DccPrimitive.new(%{session_id: session.id})
      SessionStore.store(session.id, dcc)

      superman_result =
        {:ok,
         %{
           "tool_calls" => [
             %{"name" => "Edit", "description" => "Fixed bug", "files" => ["lib/foo.ex"]}
           ]
         }}

      SupermanContinuityHook.after_call(session.id, superman_result)

      {:ok, updated_dcc} = SessionStore.fetch(session.id)
      assert updated_dcc.metadata["superman_files_touched"] == ["lib/foo.ex"]
      assert updated_dcc.metadata["superman_tools_used"] == ["Edit"]
      assert updated_dcc.metadata["last_superman_call"] != nil
    end

    test "handles nil session_id" do
      assert :ok = SupermanContinuityHook.after_call(nil, {:ok, %{}})
    end

    test "handles error results gracefully" do
      session = create_ai_session()
      assert :ok = SupermanContinuityHook.after_call(session.id, {:error, "timeout"})
    end

    test "handles empty results" do
      session = create_ai_session()
      assert :ok = SupermanContinuityHook.after_call(session.id, {:ok, %{}})
    end
  end

  describe "with_continuity/3" do
    test "wraps a Superman call with before/after hooks" do
      session = create_ai_session()

      result =
        SupermanContinuityHook.with_continuity(
          session.id,
          %{instruction: "fix auth"},
          fn enriched ->
            # Verify context was injected
            assert Map.has_key?(enriched, :session_context)
            # Simulate Superman response
            {:ok,
             %{
               "tool_calls" => [
                 %{"name" => "Edit", "description" => "Fixed auth", "files" => ["lib/auth.ex"]}
               ]
             }}
          end
        )

      assert {:ok, %{"tool_calls" => _}} = result

      # Verify after_call ran
      {:ok, %{messages: messages}} = SessionManager.get_session(session.id)
      assert Enum.any?(messages, &(&1.role == "tool"))
    end
  end
end
