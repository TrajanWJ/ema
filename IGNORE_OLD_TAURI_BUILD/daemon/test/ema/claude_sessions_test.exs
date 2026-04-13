defmodule Ema.ClaudeSessionsTest do
  use Ema.DataCase, async: false

  alias Ema.ClaudeSessions
  alias Ema.Projects

  defp create_session(attrs \\ %{}) do
    defaults = %{
      session_id: "test_#{System.unique_integer([:positive])}",
      status: "active",
      started_at: DateTime.utc_now() |> DateTime.truncate(:second)
    }

    {:ok, session} = ClaudeSessions.create_session(Map.merge(defaults, attrs))
    session
  end

  defp create_project(attrs \\ %{}) do
    slug = "proj-#{System.unique_integer([:positive])}"

    defaults = %{
      slug: slug,
      name: "Test Project #{slug}",
      linked_path: "/tmp/test/#{slug}"
    }

    {:ok, project} = Projects.create_project(Map.merge(defaults, attrs))
    project
  end

  describe "create_session/1" do
    test "creates a session with valid attrs" do
      assert {:ok, session} =
               ClaudeSessions.create_session(%{
                 session_id: "sess-abc",
                 status: "active"
               })

      assert session.session_id == "sess-abc"
      assert session.status == "active"
      assert String.starts_with?(session.id, "sess_")
    end

    test "creates with explicit id" do
      assert {:ok, session} =
               ClaudeSessions.create_session(%{
                 id: "custom-id-123",
                 session_id: "sess-custom"
               })

      assert session.id == "custom-id-123"
    end

    test "defaults status to active" do
      assert {:ok, session} =
               ClaudeSessions.create_session(%{session_id: "new-sess"})

      assert session.status == "active"
    end

    test "rejects invalid status" do
      assert {:error, changeset} =
               ClaudeSessions.create_session(%{
                 session_id: "bad",
                 status: "invalid"
               })

      assert %{status: _} = errors_on(changeset)
    end
  end

  describe "get_session/1" do
    test "returns session by id" do
      session = create_session()
      found = ClaudeSessions.get_session(session.id)
      assert found.id == session.id
    end

    test "returns nil for unknown id" do
      assert ClaudeSessions.get_session("nonexistent") == nil
    end
  end

  describe "update_session/2" do
    test "updates session fields" do
      session = create_session()

      assert {:ok, updated} =
               ClaudeSessions.update_session(session, %{
                 summary: "did some work",
                 token_count: 5000
               })

      assert updated.summary == "did some work"
      assert updated.token_count == 5000
    end
  end

  describe "list_sessions/1" do
    test "returns sessions ordered by started_at desc" do
      earlier = DateTime.add(DateTime.utc_now(), -3600) |> DateTime.truncate(:second)
      later = DateTime.utc_now() |> DateTime.truncate(:second)

      create_session(%{session_id: "old", started_at: earlier})
      create_session(%{session_id: "new", started_at: later})

      sessions = ClaudeSessions.list_sessions()
      assert length(sessions) == 2
      assert hd(sessions).session_id == "new"
    end

    test "filters by status" do
      create_session(%{status: "active"})
      create_session(%{status: "completed"})

      active = ClaudeSessions.list_sessions(status: "active")
      assert length(active) == 1
      assert hd(active).status == "active"
    end

    test "filters by project_id" do
      project = create_project()
      session = create_session()
      ClaudeSessions.link_to_project(session, project.id)
      create_session(%{session_id: "unlinked"})

      linked = ClaudeSessions.list_sessions(project_id: project.id)
      assert length(linked) == 1
      assert hd(linked).id == session.id
    end

    test "respects limit" do
      for i <- 1..5, do: create_session(%{session_id: "s#{i}"})

      sessions = ClaudeSessions.list_sessions(limit: 2)
      assert length(sessions) == 2
    end
  end

  describe "get_active_sessions/0" do
    test "returns only active sessions" do
      create_session(%{status: "active"})
      create_session(%{status: "completed"})
      create_session(%{status: "abandoned"})

      active = ClaudeSessions.get_active_sessions()
      assert length(active) == 1
      assert hd(active).status == "active"
    end
  end

  describe "link_to_project/2" do
    test "links a session struct to a project" do
      project = create_project()
      session = create_session()

      assert {:ok, linked} = ClaudeSessions.link_to_project(session, project.id)
      assert linked.project_id == project.id
    end

    test "links by session id string" do
      project = create_project()
      session = create_session()

      assert {:ok, linked} = ClaudeSessions.link_to_project(session.id, project.id)
      assert linked.project_id == project.id
    end

    test "returns error for unknown session id" do
      assert {:error, :not_found} = ClaudeSessions.link_to_project("nope", "proj-1")
    end
  end

  describe "complete_session/1" do
    test "marks session as completed with ended_at" do
      session = create_session(%{status: "active"})

      assert {:ok, completed} = ClaudeSessions.complete_session(session)
      assert completed.status == "completed"
      assert completed.ended_at != nil
    end
  end

  describe "list_unlinked/0" do
    test "returns sessions without a project" do
      project = create_project()
      linked = create_session()
      ClaudeSessions.link_to_project(linked, project.id)
      unlinked = create_session(%{session_id: "orphan"})

      result = ClaudeSessions.list_unlinked()
      ids = Enum.map(result, & &1.id)
      assert unlinked.id in ids
      refute linked.id in ids
    end
  end
end
