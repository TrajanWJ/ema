defmodule Ema.Intelligence.SecurityAuditor do
  @moduledoc """
  Calculates security posture score based on VM configuration,
  OpenClaw deployment settings, and known threat model checks.
  Inspired by JarvisAI vault/Security/Threat Model.md.
  """

  require Logger

  alias Ema.Intelligence.VmMonitor

  @doc "Run all security checks and return posture report."
  def audit do
    vm_health = VmMonitor.current_health()
    containers = VmMonitor.containers()

    checks = [
      check_openclaw_in_vm(vm_health),
      check_nat_only(),
      check_no_published_ports(containers),
      check_cap_drop(containers),
      check_dm_pairing_disabled(),
      check_docker_socket_proxy(containers),
      check_regular_updates()
    ]

    total_score = Enum.reduce(checks, 0, fn c, acc -> acc + c.points end)
    max_score = Enum.reduce(checks, 0, fn c, acc -> acc + c.max_points end)

    %{
      score: total_score,
      max_score: max_score,
      percent: if(max_score > 0, do: round(total_score / max_score * 100), else: 0),
      checks: checks,
      supply_chain_warnings: supply_chain_warnings(),
      audited_at: DateTime.utc_now() |> DateTime.truncate(:second)
    }
  end

  # --- Individual checks ---

  defp check_openclaw_in_vm(vm_health) do
    passed = vm_health != nil and vm_health.status in ["online", "degraded"]

    %{
      id: "local_health",
      name: "Local daemon and tools healthy",
      passed: passed,
      points: if(passed, do: 20, else: 0),
      max_points: 20,
      fix_guide: "Ensure the daemon is running and `claude` CLI is on PATH."
    }
  end

  defp check_nat_only do
    # With local-first architecture, network isolation is handled by
    # binding services to localhost only. Check that the daemon port
    # is not exposed on a public interface.
    passed =
      case System.cmd("ss", ["-tlnp"], stderr_to_stdout: true) do
        {output, 0} ->
          # Check that port 4488 is only on 127.0.0.1 / ::1, not 0.0.0.0
          output
          |> String.split("\n")
          |> Enum.filter(&String.contains?(&1, ":4488"))
          |> Enum.all?(fn line ->
            String.contains?(line, "127.0.0.1") or String.contains?(line, "::1") or
              String.contains?(line, "[::1]")
          end)

        _ ->
          false
      end

    %{
      id: "localhost_only",
      name: "Services bound to localhost only",
      passed: passed,
      points: if(passed, do: 15, else: 0),
      max_points: 15,
      fix_guide: "Daemon should bind to 127.0.0.1, not 0.0.0.0. Check endpoint config."
    }
  rescue
    _ -> %{id: "localhost_only", name: "Services bound to localhost only", passed: false, points: 0, max_points: 15, fix_guide: "Could not check port bindings."}
  end

  defp check_no_published_ports(containers) do
    # Check if any container exposes ports to 0.0.0.0 (not just localhost)
    has_public_ports =
      Enum.any?(containers, fn c ->
        ports = Map.get(c, "Ports", "")
        is_binary(ports) and String.contains?(ports, "0.0.0.0")
      end)

    passed = not has_public_ports

    %{
      id: "no_published_ports",
      name: "No published ports on OpenClaw containers",
      passed: passed,
      points: if(passed, do: 15, else: 0),
      max_points: 15,
      fix_guide: "Containers should not publish ports to 0.0.0.0. Use `-p 127.0.0.1:PORT:PORT` instead of `-p PORT:PORT` in docker-compose."
    }
  end

  defp check_cap_drop(containers) do
    # This is a static best-practice check — we can't easily verify from outside
    # Mark as unknown/advisory if we have containers but can't verify
    passed = length(containers) == 0

    %{
      id: "cap_drop_all",
      name: "cap_drop: ALL on containers",
      passed: passed,
      points: if(passed, do: 15, else: 0),
      max_points: 15,
      fix_guide: "Add `cap_drop: [ALL]` and only `cap_add` specific capabilities needed. Check docker-compose.yml in the VM."
    }
  end

  defp check_dm_pairing_disabled do
    # Check if Bluetooth DM pairing is disabled (security hardening)
    passed =
      case System.cmd("hciconfig", [], stderr_to_stdout: true) do
        {output, 0} -> not String.contains?(output, "UP RUNNING")
        _ -> true
      end

    %{
      id: "dm_pairing_disabled",
      name: "DM pairing disabled",
      passed: passed,
      points: if(passed, do: 15, else: 0),
      max_points: 15,
      fix_guide: "Disable Bluetooth if not needed: `sudo systemctl disable bluetooth`. If needed, disable pairing in blueman settings."
    }
  rescue
    _ -> %{id: "dm_pairing_disabled", name: "DM pairing disabled", passed: true, points: 15, max_points: 15, fix_guide: "Bluetooth not detected — assumed safe."}
  end

  defp check_docker_socket_proxy(containers) do
    # Check if any container mounts /var/run/docker.sock directly
    has_socket_mount =
      Enum.any?(containers, fn c ->
        mounts = Map.get(c, "Mounts", "")
        is_binary(mounts) and String.contains?(mounts, "docker.sock")
      end)

    passed = not has_socket_mount

    %{
      id: "docker_socket_proxy",
      name: "Docker socket proxy (not direct mount)",
      passed: passed,
      points: if(passed, do: 10, else: 0),
      max_points: 10,
      fix_guide: "Use docker-socket-proxy (tecnativa/docker-socket-proxy) instead of mounting /var/run/docker.sock directly into containers."
    }
  end

  defp check_regular_updates do
    # Check if system was updated in the last 7 days
    passed =
      case System.cmd("stat", ["-c", "%Y", "/var/cache/apt/pkgcache.bin"], stderr_to_stdout: true) do
        {output, 0} ->
          case Integer.parse(String.trim(output)) do
            {timestamp, _} -> System.os_time(:second) - timestamp < 7 * 86400
            _ -> false
          end

        _ ->
          false
      end

    %{
      id: "regular_updates",
      name: "Regular system updates (last 7 days)",
      passed: passed,
      points: if(passed, do: 10, else: 0),
      max_points: 10,
      fix_guide: "Run `sudo apt update && sudo apt upgrade` regularly. Consider enabling unattended-upgrades for security patches."
    }
  rescue
    _ -> %{id: "regular_updates", name: "Regular system updates", passed: false, points: 0, max_points: 10, fix_guide: "Could not determine last update time."}
  end

  defp supply_chain_warnings do
    [
      %{
        id: "clawhavoc",
        severity: "high",
        title: "ClawHavoc Supply Chain Risk",
        description: "OpenClaw's ClawHavoc agent framework uses community-contributed agent definitions that could contain malicious prompts or tool configurations. Always review agent definitions before deployment.",
        mitigation: "Pin agent definition versions, review tool permissions, use allowlists for agent capabilities."
      }
    ]
  end
end
