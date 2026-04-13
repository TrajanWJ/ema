defmodule EmaWeb.PromptsChannel do
  use EmaWeb, :channel

  alias Ema.Prompts.Prompt
  alias Ema.Prompts.Store
  alias EmaWeb.PromptJSON

  @topic "prompts:updated"

  @impl true
  def join("prompts:lobby", _payload, socket) do
    :ok = Phoenix.PubSub.subscribe(Ema.PubSub, @topic)

    prompts =
      Store.list_latest_per_kind()
      |> PromptJSON.prompts()

    {:ok, %{prompts: prompts, templates: prompts}, assign(socket, :prompt_kind, :all)}
  end

  def join("prompts:" <> kind, _payload, socket) do
    :ok = Phoenix.PubSub.subscribe(Ema.PubSub, @topic)

    prompts =
      Store.list_prompts_by_kind(kind)
      |> PromptJSON.prompts()

    {:ok, %{prompts: prompts, templates: prompts}, assign(socket, :prompt_kind, kind)}
  end

  @impl true
  def handle_info({:prompt_updated, %Prompt{} = prompt}, socket) do
    if matches_topic?(socket.assigns.prompt_kind, prompt.kind) do
      push(socket, "prompt_updated", %{prompt: PromptJSON.prompt(prompt)})
    end

    {:noreply, socket}
  end

  defp matches_topic?(:all, _kind), do: true
  defp matches_topic?(kind, kind), do: true
  defp matches_topic?(_, _), do: false
end
