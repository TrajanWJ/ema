defmodule Ema.Claude.RunnerTest do
  use ExUnit.Case, async: true

  alias Ema.Claude.Runner

  describe "run/2" do
    test "returns parsed JSON on success" do
      mock_cmd = fn "bash", ["-c", shell_cmd], _opts ->
        assert shell_cmd =~ "claude"
        assert shell_cmd =~ "--print"
        assert shell_cmd =~ "--output-format json"
        {~s({"title": "Test", "summary": "A test"}), 0}
      end

      assert {:ok, result} = Runner.run("test prompt", cmd_fn: mock_cmd)
      assert result["title"] == "Test"
      assert result["summary"] == "A test"
    end

    test "returns raw output when JSON parsing fails" do
      mock_cmd = fn "bash", ["-c", _shell_cmd], _opts ->
        {"Just some plain text response", 0}
      end

      assert {:ok, result} = Runner.run("test prompt", cmd_fn: mock_cmd)
      assert result["raw"] == "Just some plain text response"
    end

    test "returns error on non-zero exit code" do
      mock_cmd = fn "bash", ["-c", _shell_cmd], _opts ->
        {"Command failed", 1}
      end

      assert {:error, %{code: 1, message: "Command failed"}} =
               Runner.run("test prompt", cmd_fn: mock_cmd)
    end

    test "passes model option to CLI args" do
      mock_cmd = fn "bash", ["-c", shell_cmd], _opts ->
        assert shell_cmd =~ "--model haiku"
        {~s({"ok": true}), 0}
      end

      assert {:ok, _} = Runner.run("test", model: "haiku", cmd_fn: mock_cmd)
    end

    test "includes --print and --output-format json flags" do
      mock_cmd = fn "bash", ["-c", shell_cmd], _opts ->
        assert shell_cmd =~ "--print"
        assert shell_cmd =~ "--output-format json"
        {~s({}), 0}
      end

      assert {:ok, _} = Runner.run("test", cmd_fn: mock_cmd)
    end
  end
end
