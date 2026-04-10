defmodule Ema.CLI.Commands.Calendar do
  @moduledoc """
  CLI command for the calendar driver — shows scheduled work per timeframe and
  manually triggers the autonomous driver pass.

      ema calendar          # show what's scheduled per timeframe
      ema calendar drive    # manually run one drive_forward pass
      ema calendar next     # show single most important next action
  """

  alias Ema.CLI.Output

  def handle([], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Http ->
        case transport.get("/calendar") do
          {:ok, body} -> render(body, opts)
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Direct ->
        render(progress_payload(), opts)
    end
  end

  def handle([:drive], parsed, transport, opts), do: handle(["drive"], parsed, transport, opts)
  def handle([:next], parsed, transport, opts), do: handle(["next"], parsed, transport, opts)
  def handle([:progress], parsed, transport, opts), do: handle([], parsed, transport, opts)

  def handle(["drive"], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Http ->
        case transport.post("/calendar/drive", %{}) do
          {:ok, body} -> render(body, opts)
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Direct ->
        report = Ema.Intelligence.CalendarDriver.drive_now()
        payload = %{ran: true, surfaced: report.surfaced, items: length(report.items)}
        render(payload, opts)
    end
  end

  def handle(["next"], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Http ->
        case transport.get("/calendar/next") do
          {:ok, body} -> render(body, opts)
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Direct ->
        payload =
          case Ema.Intelligence.CalendarDriver.next_action() do
            {:ok, title, reason} -> %{action: title, reason: reason}
            {:idle, msg} -> %{action: nil, reason: msg}
          end

        render(payload, opts)
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown calendar subcommand: #{inspect(sub)}")
  end

  defp progress_payload do
    %{
      summary: Ema.Intelligence.CalendarDriver.progress_summary(),
      next_action: format_next(Ema.Intelligence.CalendarDriver.next_action()),
      last_report: Ema.Intelligence.CalendarDriver.last_report()
    }
  end

  defp format_next({:ok, title, reason}), do: %{action: title, reason: reason}
  defp format_next({:idle, msg}), do: %{action: nil, reason: msg}

  defp render(payload, %{json: true}), do: Output.json(payload)
  defp render(payload, _opts), do: Output.detail(payload)
end
