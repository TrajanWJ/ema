defmodule Ema.Claude.Adapter do
  @moduledoc """
  Behaviour definition for all AI backend adapters.

  Each adapter wraps a different AI provider (Claude CLI, Codex, OpenRouter, Ollama, etc.)
  and provides a unified interface for session management, messaging, and event parsing.
  """

  @doc """
  Start a new session with the given prompt, session ID, model, and options.
  Returns `{:ok, port_or_pid}` or `{:error, reason}`.
  """
  @callback start_session(
              prompt :: String.t(),
              session_id :: String.t(),
              model :: String.t(),
              opts :: keyword()
            ) :: {:ok, port() | pid()} | {:error, term()}

  @doc """
  Send a message to an existing session.
  """
  @callback send_message(session :: port() | pid(), message :: String.t()) ::
              :ok | {:error, term()}

  @doc """
  Stop and clean up a session.
  """
  @callback stop_session(session :: port() | pid()) :: :ok

  @doc """
  Return a map describing the adapter's capabilities.
  Expected keys: :streaming, :multi_turn, :tool_use, :models, :task_types
  """
  @callback capabilities() :: map()

  @doc """
  Check if the adapter's backend is available and healthy.
  """
  @callback health_check() :: :ok | {:error, term()}

  @doc """
  Parse a raw binary event from the backend stream into a normalized map.
  Returns `{:ok, event_map}`, `:skip` for events to ignore, or `{:error, reason}`.

  Normalized event map keys:
  - `:type` — :text_delta | :tool_use | :message_start | :message_stop | :error
  - `:content` — string content (for text_delta)
  - `:usage` — token usage map (for message_stop)
  - `:raw` — original raw data
  """
  @callback parse_event(raw :: binary()) :: {:ok, map()} | :skip | {:error, term()}
end
