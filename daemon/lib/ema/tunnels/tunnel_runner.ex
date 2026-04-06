defmodule Ema.Tunnels.TunnelRunner do
  @moduledoc """
  Stub tunnel runner — tracks tunnel state without actually spawning processes.
  In a real implementation, this would spawn cloudflared/ngrok subprocesses.
  """
  require Logger

  alias Ema.Tunnels

  def start_tunnel(tunnel_id) do
    Logger.info("TunnelRunner: starting tunnel #{tunnel_id} (stub)")
    Tunnels.update_tunnel(tunnel_id, %{status: "running"})
  end

  def stop_tunnel(tunnel_id) do
    Logger.info("TunnelRunner: stopping tunnel #{tunnel_id} (stub)")
    Tunnels.update_tunnel(tunnel_id, %{status: "stopped"})
  end
end
