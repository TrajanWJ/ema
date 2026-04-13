defmodule Ema.CLI.Commands.Invoice do
  @moduledoc "CLI commands for invoice management."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Number", :number},
    {"Client", :client},
    {"Amount", :amount},
    {"Status", :status},
    {"Due", :due_date},
    {"Updated", :updated_at}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Invoices, :list_invoices, []) do
          {:ok, invoices} -> Output.render(invoices, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/invoices") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "invoices"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Invoices, :get_invoice, [id]) do
          {:ok, nil} -> Output.error("Invoice #{id} not found")
          {:ok, invoice} -> Output.detail(invoice, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/invoices/#{id}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "invoice"), json: opts[:json])
          {:error, :not_found} -> Output.error("Invoice #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:client, parsed.args.client},
            {:amount, parsed.options[:amount]},
            {:description, parsed.options[:description]},
            {:due_date, parsed.options[:due]}
          ])

        case transport.call(Ema.Invoices, :create_invoice, [attrs]) do
          {:ok, invoice} ->
            Output.success("Created invoice: #{invoice.id}")
            if opts[:json], do: Output.json(invoice)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "invoice" =>
            Helpers.compact_map([
              {"client", parsed.args.client},
              {"amount", parsed.options[:amount]},
              {"description", parsed.options[:description]},
              {"due_date", parsed.options[:due]}
            ])
        }

        case transport.post("/invoices", body) do
          {:ok, resp} ->
            i = Helpers.extract_record(resp, "invoice")
            Output.success("Created invoice: #{i["id"]}")
            if opts[:json], do: Output.json(i)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:update], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:client, parsed.options[:client]},
            {:amount, parsed.options[:amount]},
            {:description, parsed.options[:description]},
            {:due_date, parsed.options[:due]}
          ])

        case transport.call(Ema.Invoices, :update_invoice, [id, attrs]) do
          {:ok, invoice} ->
            Output.success("Updated invoice: #{invoice.id}")
            if opts[:json], do: Output.json(invoice)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "invoice" =>
            Helpers.compact_map([
              {"client", parsed.options[:client]},
              {"amount", parsed.options[:amount]},
              {"description", parsed.options[:description]},
              {"due_date", parsed.options[:due]}
            ])
        }

        case transport.put("/invoices/#{id}", body) do
          {:ok, resp} ->
            i = Helpers.extract_record(resp, "invoice")
            Output.success("Updated invoice: #{i["id"]}")
            if opts[:json], do: Output.json(i)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:delete], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Invoices, :delete_invoice, [id]) do
          {:ok, _} -> Output.success("Deleted invoice #{id}")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.delete("/invoices/#{id}") do
          {:ok, _} -> Output.success("Deleted invoice #{id}")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:send], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Invoices, :send_invoice, [id]) do
          {:ok, _} -> Output.success("Invoice #{id} sent")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/invoices/#{id}/send", %{}) do
          {:ok, _} -> Output.success("Invoice #{id} sent")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:"mark-paid"], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Invoices, :mark_paid, [id]) do
          {:ok, _} -> Output.success("Invoice #{id} marked as paid")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/invoices/#{id}/mark-paid", %{}) do
          {:ok, _} -> Output.success("Invoice #{id} marked as paid")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown invoice subcommand: #{inspect(sub)}")
  end
end
