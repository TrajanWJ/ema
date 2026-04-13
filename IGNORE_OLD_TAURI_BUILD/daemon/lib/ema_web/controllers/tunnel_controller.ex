defmodule EmaWeb.TunnelController do
  use EmaWeb, :controller

  action_fallback EmaWeb.FallbackController

  def index(conn, _params) do
    tunnels = list_ssh_tunnels()
    json(conn, %{tunnels: tunnels})
  end

  def create(conn, params) do
    with {:ok, local_port} <- parse_port(params["local_port"]),
         {:ok, remote_port} <- parse_port(params["remote_port"]),
         {:ok, remote_host} <- parse_host(params["remote_host"], :host),
         {:ok, ssh_host} <- parse_host(params["ssh_host"], :ssh_host) do
      forward = "#{local_port}:#{remote_host}:#{remote_port}"

      case System.cmd("ssh", ["-fNL", forward, ssh_host], stderr_to_stdout: true) do
        {_output, 0} ->
          conn
          |> put_status(:created)
          |> json(%{
            ok: true,
            tunnel: %{
              local_port: Integer.to_string(local_port),
              remote_host: remote_host,
              remote_port: Integer.to_string(remote_port),
              ssh_host: ssh_host
            }
          })

        {output, _code} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "tunnel_failed", message: String.trim(output)})
      end
    else
      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "invalid_params", message: reason})
    end
  end

  def delete(conn, %{"pid" => pid_string}) do
    with {:ok, pid} <- parse_pid(pid_string) do
      case System.cmd("kill", [Integer.to_string(pid)], stderr_to_stdout: true) do
        {_output, 0} ->
          json(conn, %{ok: true})

        {output, _code} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "kill_failed", message: String.trim(output)})
      end
    else
      {:error, reason} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: reason})
    end
  end

  defp parse_port(value) when is_integer(value), do: parse_port(Integer.to_string(value))

  defp parse_port(value) when is_binary(value) do
    case Integer.parse(value) do
      {port, ""} when port > 0 and port < 65_536 ->
        {:ok, port}

      _ ->
        {:error, "port must be an integer between 1 and 65535"}
    end
  end

  defp parse_port(_), do: {:error, "port must be an integer"}

  defp parse_host(value, kind) when is_binary(value) do
    cleaned = String.trim(value)

    cond do
      cleaned == "" ->
        {:error, "#{kind} cannot be blank"}

      String.contains?(cleaned, "..") ->
        {:error, "#{kind} is invalid"}

      String.contains?(cleaned, [" ", "\n", "\r", "\t"]) ->
        {:error, "#{kind} is invalid"}

      true ->
        {:ok, cleaned}
    end
  end

  defp parse_host(_, kind), do: {:error, "#{kind} must be a string"}

  defp parse_pid(pid_string) do
    case Integer.parse(pid_string || "") do
      {pid, ""} when pid > 0 ->
        {:ok, pid}

      _ ->
        {:error, "invalid_pid"}
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
