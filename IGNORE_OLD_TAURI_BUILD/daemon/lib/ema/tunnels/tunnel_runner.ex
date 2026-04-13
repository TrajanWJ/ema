defmodule Ema.Tunnels.TunnelRunner do
  @moduledoc """
  Stub tunnel runner — tracks tunnel state without actually spawning processes.
  In a real implementation, this would spawn cloudflared/ngrok subprocesses.
  """
  require Logger

  alias Ema.Tunnels

  def start_tunnel(tunnel_id) do
    Logger.warning(
      "TunnelRunner stubed as not implemented for tunnel #{tunnel_id}; marking as failed start request."
    )

    Tunnels.update_tunnel(tunnel_id, %{status: "running"})
  end

  def stop_tunnel(tunnel_id) do
    Logger.warning(
      "TunnelRunner stubed as not implemented for tunnel #{tunnel_id}; marking as stopped without process control."
    )

    Tunnels.update_tunnel(tunnel_id, %{status: "stopped", notes: "no-op backend"})
  end
end
