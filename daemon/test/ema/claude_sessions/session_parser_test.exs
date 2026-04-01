defmodule Ema.ClaudeSessions.SessionParserTest do
  use ExUnit.Case, async: true

  alias Ema.ClaudeSessions.SessionParser

  describe "parse_content/2" do
    test "parses valid JSONL with basic messages" do
      content = """
      {"type":"human","sessionId":"abc-123","timestamp":"2026-03-30T10:00:00Z","content":"hello"}
      {"type":"assistant","sessionId":"abc-123","timestamp":"2026-03-30T10:01:00Z","content":"hi there"}
      """

      assert {:ok, parsed} = SessionParser.parse_content(content)
      assert parsed.session_id == "abc-123"
      assert parsed.messages |> length() == 2
      assert parsed.started_at != nil
      assert parsed.ended_at != nil
    end

    test "counts tool calls" do
      content = """
      {"type":"human","sessionId":"tc-1","content":"read file"}
      {"type":"assistant","content":[{"type":"tool_use","name":"Read","input":{"file_path":"/tmp/foo.ex"}}]}
      {"type":"assistant","content":[{"type":"tool_use","name":"Edit","input":{"file_path":"/tmp/bar.ex"}}]}
      """

      assert {:ok, parsed} = SessionParser.parse_content(content)
      assert parsed.tool_calls == 2
    end

    test "extracts files from tool inputs" do
      content = """
      {"type":"assistant","content":[{"type":"tool_use","name":"Read","input":{"file_path":"/home/user/project/lib/app.ex"}}]}
      {"type":"assistant","content":[{"type":"tool_use","name":"Edit","input":{"file_path":"/home/user/project/lib/web.ex"}}]}
      """

      assert {:ok, parsed} = SessionParser.parse_content(content)
      assert "/home/user/project/lib/app.ex" in parsed.files_touched
      assert "/home/user/project/lib/web.ex" in parsed.files_touched
    end

    test "extracts token counts from usage" do
      content = """
      {"type":"assistant","usage":{"input_tokens":100,"output_tokens":50}}
      {"type":"assistant","usage":{"input_tokens":200,"output_tokens":75}}
      """

      assert {:ok, parsed} = SessionParser.parse_content(content)
      assert parsed.token_count == 425
    end

    test "handles empty content" do
      assert {:error, :empty_session} = SessionParser.parse_content("")
    end

    test "handles malformed lines gracefully" do
      content = """
      {"type":"human","sessionId":"robust","content":"good line"}
      this is not json at all
      {"type":"assistant","content":"also good"}
      """

      assert {:ok, parsed} = SessionParser.parse_content(content)
      assert parsed.session_id == "robust"
      assert length(parsed.messages) == 2
    end

    test "extracts project_path from cwd field" do
      content = """
      {"type":"human","cwd":"/home/user/my-project","content":"hello"}
      """

      assert {:ok, parsed} = SessionParser.parse_content(content)
      assert parsed.project_path == "/home/user/my-project"
    end

    test "falls back to filename as session_id" do
      content = """
      {"type":"human","content":"no session id here"}
      """

      assert {:ok, parsed} =
               SessionParser.parse_content(content, "/tmp/sessions/my-session.jsonl")

      assert parsed.session_id == "my-session"
    end

    test "handles integer timestamps" do
      # 2026-03-30T10:00:00Z in milliseconds
      ts = 1_774_965_600_000

      content = """
      {"type":"human","ts":#{ts},"content":"hello"}
      """

      assert {:ok, parsed} = SessionParser.parse_content(content)
      assert parsed.started_at != nil
    end
  end

  describe "parse_file/1" do
    test "returns error for missing file" do
      assert {:error, {:file_read_failed, :enoent}} =
               SessionParser.parse_file(
                 "/tmp/nonexistent_session_#{System.unique_integer()}.jsonl"
               )
    end

    test "parses a real file" do
      path = Path.join(System.tmp_dir!(), "test_session_#{System.unique_integer()}.jsonl")

      content = """
      {"type":"human","sessionId":"file-test","content":"from file"}
      {"type":"assistant","content":"response"}
      """

      File.write!(path, content)

      assert {:ok, parsed} = SessionParser.parse_file(path)
      assert parsed.session_id == "file-test"
    after
      # cleanup handled by tmp dir
      :ok
    end
  end
end
