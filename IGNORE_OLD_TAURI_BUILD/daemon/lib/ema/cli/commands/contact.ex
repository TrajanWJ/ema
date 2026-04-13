defmodule Ema.CLI.Commands.Contact do
  @moduledoc "CLI commands for contact management."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Name", :name},
    {"Email", :email},
    {"Role", :role},
    {"Updated", :updated_at}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Contacts, :list_contacts, []) do
          {:ok, contacts} -> Output.render(contacts, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/contacts") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "contacts"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Contacts, :get_contact, [id]) do
          {:ok, nil} -> Output.error("Contact #{id} not found")
          {:ok, contact} -> Output.detail(contact, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/contacts/#{id}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "contact"), json: opts[:json])
          {:error, :not_found} -> Output.error("Contact #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    name = parsed.args.name

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:name, name},
            {:email, parsed.options[:email]},
            {:role, parsed.options[:role]},
            {:phone, parsed.options[:phone]},
            {:notes, parsed.options[:notes]}
          ])

        case transport.call(Ema.Contacts, :create_contact, [attrs]) do
          {:ok, contact} ->
            Output.success("Created contact: #{contact.name}")
            if opts[:json], do: Output.json(contact)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "contact" =>
            Helpers.compact_map([
              {"name", name},
              {"email", parsed.options[:email]},
              {"role", parsed.options[:role]},
              {"phone", parsed.options[:phone]},
              {"notes", parsed.options[:notes]}
            ])
        }

        case transport.post("/contacts", body) do
          {:ok, resp} ->
            c = Helpers.extract_record(resp, "contact")
            Output.success("Created contact: #{c["name"]}")
            if opts[:json], do: Output.json(c)

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
            {:name, parsed.options[:name]},
            {:email, parsed.options[:email]},
            {:role, parsed.options[:role]},
            {:phone, parsed.options[:phone]},
            {:notes, parsed.options[:notes]}
          ])

        case transport.call(Ema.Contacts, :update_contact, [id, attrs]) do
          {:ok, contact} ->
            Output.success("Updated contact: #{contact.name}")
            if opts[:json], do: Output.json(contact)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "contact" =>
            Helpers.compact_map([
              {"name", parsed.options[:name]},
              {"email", parsed.options[:email]},
              {"role", parsed.options[:role]},
              {"phone", parsed.options[:phone]},
              {"notes", parsed.options[:notes]}
            ])
        }

        case transport.put("/contacts/#{id}", body) do
          {:ok, resp} ->
            c = Helpers.extract_record(resp, "contact")
            Output.success("Updated contact: #{c["name"]}")
            if opts[:json], do: Output.json(c)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:delete], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Contacts, :delete_contact, [id]) do
          {:ok, _} -> Output.success("Deleted contact #{id}")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.delete("/contacts/#{id}") do
          {:ok, _} -> Output.success("Deleted contact #{id}")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown contact subcommand: #{inspect(sub)}")
  end
end
