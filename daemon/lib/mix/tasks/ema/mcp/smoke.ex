defmodule Mix.Tasks.Ema.Mcp.Smoke do
  use Mix.Task

  @shortdoc "Run a deterministic EMA MCP stdio smoke test"

  @moduledoc """
  Compiles the daemon, launches the stdio MCP runner in a child process, and
  verifies an agent-workspace flow end-to-end:

    1. initialize
    2. tools/list
    3. resources/list
    4. resources/read ema://bootstrap/status
    5. tools/call bootstrap_status
  """

  @impl Mix.Task
  def run(_args) do
    Mix.Task.run("compile", ["--quiet"])

    python = System.find_executable("python3") || System.find_executable("python")

    unless python do
      Mix.raise("Could not find python3 or python for MCP smoke verification")
    end

    {output, status} =
      System.cmd(python, ["-c", python_script()],
        cd: File.cwd!(),
        env: [{"EMA_PROJECT_ROOT", File.cwd!()}],
        stderr_to_stdout: true
      )

    Mix.shell().info(String.trim(output))

    if status != 0 do
      Mix.raise("MCP smoke failed")
    end
  end

  defp python_script do
    """
    import glob, json, os, pathlib, select, subprocess, sys, time

    project_root = pathlib.Path(os.environ["EMA_PROJECT_ROOT"])
    daemon_root = project_root
    trace = pathlib.Path("/tmp/ema_mcp_trace.log")

    paths = []
    for p in glob.glob(str(daemon_root / "_build" / "dev" / "lib" / "*" / "ebin")):
        paths.extend(["-pa", p])

    env = os.environ.copy()
    env["EMA_MCP_TRACE_FILE"] = str(trace)
    env["EMA_MCP_STDIO"] = "1"

    cmd = ["elixir", *paths, "-e", "Ema.MCP.StdioRunner.run()"]
    proc = subprocess.Popen(
        cmd,
        cwd=str(daemon_root),
        env=env,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )

    def wait_for_port():
        deadline = time.time() + 30
        while time.time() < deadline:
            if trace.exists() and "init:port_opened" in trace.read_text():
                return
            time.sleep(0.1)
        raise RuntimeError("stdio runner did not open its port")

    def send_rpc(msg):
        proc.stdin.write(json.dumps(msg) + "\\n")
        proc.stdin.flush()

    def read_response(msg_id, timeout=20):
        deadline = time.time() + timeout
        stderr_lines = []

        while time.time() < deadline:
          r, _, _ = select.select([proc.stdout, proc.stderr], [], [], 1.0)
          if not r:
              continue

          for stream in r:
              line = stream.readline()
              if not line:
                  continue

              if stream is proc.stderr:
                  stderr_lines.append(line.strip())
                  continue

              line = line.strip()
              if not line:
                  continue

              payload = json.loads(line)
              if payload.get("id") == msg_id:
                  return payload, stderr_lines

        raise RuntimeError(f"timed out waiting for response {msg_id}; stderr={stderr_lines}")

    try:
        if trace.exists():
            trace.unlink()

        wait_for_port()

        send_rpc({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "ema-mcp-smoke", "version": "1.0"},
            },
        })
        init, _ = read_response(1)
        assert init["result"]["protocolVersion"] == "2024-11-05"

        send_rpc({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
        tools, _ = read_response(2)
        tool_names = {tool["name"] for tool in tools["result"]["tools"]}
        for required in ["bootstrap_status", "run_bootstrap", "ema_list_sessions"]:
            assert required in tool_names, f"missing tool {required}"

        send_rpc({"jsonrpc": "2.0", "id": 3, "method": "resources/list", "params": {}})
        resources, _ = read_response(3)
        resource_uris = {resource["uri"] for resource in resources["result"]["resources"]}
        for required in ["ema://bootstrap/status", "ema://focus/current"]:
            assert required in resource_uris, f"missing resource {required}"

        send_rpc({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "resources/read",
            "params": {"uri": "ema://bootstrap/status"},
        })
        resource_read, _ = read_response(4)
        content_text = resource_read["result"]["contents"][0]["text"]
        content = json.loads(content_text)
        assert "readiness" in content["data"], "bootstrap resource missing readiness"

        send_rpc({
            "jsonrpc": "2.0",
            "id": 5,
            "method": "tools/call",
            "params": {
                "name": "bootstrap_status",
                "arguments": {},
                "_meta": {"requestId": "smoke-bootstrap-status"},
            },
        })
        tool_call, _ = read_response(5)
        assert tool_call["result"]["isError"] is False
        payload = json.loads(tool_call["result"]["content"][0]["text"])
        assert payload["readiness"]["ready_for_active_use"] is True

        print("MCP smoke passed")
        print(f"tools={len(tool_names)} resources={len(resource_uris)}")
    except Exception as exc:
        print(f"MCP smoke failed: {exc}")
        if trace.exists():
            print("TRACE:")
            print(trace.read_text())
        sys.exit(1)
    finally:
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
            proc.wait(timeout=5)
    """
  end
end
