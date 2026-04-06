defmodule EmaWeb.TunnelController do
  use EmaWeb, :controller

  action_fallback EmaWeb.FallbackController

  def index(conn, _params) do
    tunnels = list_ssh_tunnels()
    json(conn, %{tunnels: tunnels})
  end

  def create(conn, params) do
    local_port = params["local_port"]
    remote_host = params["remote_host"]
    remote_port = params["remote_port"]
    ssh_host = params["ssh_host"]

    if is_nil(local_port) or is_nil(remote_host) or is_nil(remote_port) or is_nil(ssh_host) do
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{
        error: "missing_params",
        message: "Required: local_port, remote_host, remote_port, ssh_host"
      })
    else
      forward = "#{local_port}:#{remote_host}:#{remote_port}"

      case System.cmd("ssh", ["-fNL", forward, ssh_host], stderr_to_stdout: true) do
        {_output, 0} ->
          conn
          |> put_status(:created)
          |> json(%{
            ok: true,
            tunnel: %{
              local_port: local_port,
              remote_host: remote_host,
              remote_port: remote_port,
              ssh_host: ssh_host
            }
          })

        {output, _code} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "tunnel_failed", message: String.trim(output)})
      end
    end
  end

  def delete(conn, %{"pid" => pid_string}) do
    case Integer.parse(pid_string) do
      {pid, _} ->
        case System.cmd("kill", [Integer.to_string(pid)], stderr_to_stdout: true) do
          {_output, 0} ->
            json(conn, %{ok: true})

          {output, _code} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{error: "kill_failed", message: String.trim(output)})
        end

      :error ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "invalid_pid"})
    end
  end

  defp list_ssh_tunnels do
    case System.cmd("ss", ["-tlnp"], stderr_to_stdout: true) do
      {output, 0} ->
        output
        |> String.split("\n", trim: true)
        |> Enum.filter(&String.contains?(&1, "ssh"))
        |> Enum.map(&parse_ss_line/1)
        |> Enum.reject(&is_nil/1)

      {_output, _code} ->
        []
    end
  end

  defp parse_ss_line(line) do
    parts = String.split(line, ~r/\s+/, trim: true)

    pid =
      case Enum.find(parts, &String.contains?(&1, "pid=")) do
        nil ->
          nil

        pid_part ->
          case Regex.run(~r/pid=(\d+)/, pid_part) do
            [_, pid_str] -> String.to_integer(pid_str)
            _ -> nil
          end
      end

    local_addr = Enum.at(parts, 3)

    %{
      pid: pid,
      local_address: local_addr,
      state: Enum.at(parts, 0),
      raw: line
    }
  end
end
