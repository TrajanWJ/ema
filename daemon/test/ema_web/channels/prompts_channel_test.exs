defmodule EmaWeb.PromptsChannelTest do
  use EmaWeb.ChannelCase, async: false

  alias Ema.Prompts.Store
  alias EmaWeb.UserSocket

  test "lobby receives prompt_updated when a runtime prompt changes" do
    {:ok, _, _socket} =
      UserSocket
      |> socket("user_id", %{})
      |> subscribe_and_join(EmaWeb.PromptsChannel, "prompts:lobby")

    {:ok, prompt} = Store.create_prompt(%{kind: "channel_runtime_prompt", content: "hello"})
    prompt_id = prompt.id

    assert_push "prompt_updated", %{
      prompt: %{
        id: ^prompt_id,
        kind: "channel_runtime_prompt",
        content: "hello"
      }
    }
  end

  test "kind topic filters prompt updates" do
    {:ok, _, _socket} =
      UserSocket
      |> socket("user_id", %{})
      |> subscribe_and_join(EmaWeb.PromptsChannel, "prompts:filtered_runtime_prompt")

    {:ok, matching} = Store.create_prompt(%{kind: "filtered_runtime_prompt", content: "keep"})
    matching_id = matching.id
    assert_push "prompt_updated", %{prompt: %{id: ^matching_id}}

    {:ok, _other} = Store.create_prompt(%{kind: "other_runtime_prompt", content: "drop"})
    refute_push "prompt_updated", _, 100
  end
end
