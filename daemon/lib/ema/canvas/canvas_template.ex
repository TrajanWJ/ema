defmodule Ema.Canvas.CanvasTemplate do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @valid_categories ~w(productivity project planning brainstorm monitoring)

  schema "canvas_templates" do
    field :name, :string
    field :description, :string
    field :category, :string, default: "general"
    field :layout_json, :string
    field :thumbnail, :string

    timestamps(type: :utc_datetime)
  end

  def changeset(template, attrs) do
    template
    |> cast(attrs, [:id, :name, :description, :category, :layout_json, :thumbnail])
    |> validate_required([:id, :name, :layout_json])
    |> validate_inclusion(:category, @valid_categories)
  end

  @doc "Built-in templates seeded on first load."
  def stock_templates do
    [
      %{
        id: "tpl_sprint_board",
        name: "Sprint Board",
        description: "Kanban-style board with columns for backlog, in-progress, review, and done",
        category: "project",
        layout_json:
          Jason.encode!(%{
            canvas: %{name: "Sprint Board", canvas_type: "planning"},
            elements: [
              %{
                element_type: "text",
                x: 40,
                y: 30,
                width: 200,
                height: 40,
                text: "Backlog",
                style: %{fontSize: 18, fontWeight: "bold"}
              },
              %{
                element_type: "text",
                x: 300,
                y: 30,
                width: 200,
                height: 40,
                text: "In Progress",
                style: %{fontSize: 18, fontWeight: "bold"}
              },
              %{
                element_type: "text",
                x: 560,
                y: 30,
                width: 200,
                height: 40,
                text: "Review",
                style: %{fontSize: 18, fontWeight: "bold"}
              },
              %{
                element_type: "text",
                x: 820,
                y: 30,
                width: 200,
                height: 40,
                text: "Done",
                style: %{fontSize: 18, fontWeight: "bold"}
              },
              %{
                element_type: "sticky",
                x: 40,
                y: 90,
                width: 200,
                height: 120,
                text: "Task 1",
                style: %{color: "#fbbf24"}
              },
              %{
                element_type: "sticky",
                x: 300,
                y: 90,
                width: 200,
                height: 120,
                text: "Task 2",
                style: %{color: "#60a5fa"}
              },
              %{
                element_type: "sticky",
                x: 560,
                y: 90,
                width: 200,
                height: 120,
                text: "Task 3",
                style: %{color: "#a78bfa"}
              },
              %{
                element_type: "sticky",
                x: 820,
                y: 90,
                width: 200,
                height: 120,
                text: "Task 4",
                style: %{color: "#34d399"}
              }
            ]
          })
      },
      %{
        id: "tpl_agent_network",
        name: "Agent Network",
        description: "Visualize active agents, their channels, and data flows",
        category: "monitoring",
        layout_json:
          Jason.encode!(%{
            canvas: %{name: "Agent Network", canvas_type: "monitoring"},
            elements: [
              %{
                element_type: "text",
                x: 350,
                y: 20,
                width: 300,
                height: 40,
                text: "Agent Network",
                style: %{fontSize: 22, fontWeight: "bold"}
              },
              %{
                element_type: "number_card",
                x: 40,
                y: 100,
                width: 220,
                height: 140,
                text: "Active Tasks",
                data_source: "tasks:by_status",
                refresh_interval: 30
              },
              %{
                element_type: "number_card",
                x: 300,
                y: 100,
                width: 220,
                height: 140,
                text: "Proposals",
                data_source: "proposals:by_confidence",
                refresh_interval: 60
              },
              %{
                element_type: "bar_chart",
                x: 40,
                y: 280,
                width: 480,
                height: 260,
                text: "Tasks by Project",
                data_source: "tasks:by_project",
                refresh_interval: 60
              }
            ]
          })
      },
      %{
        id: "tpl_project_overview",
        name: "Project Overview",
        description:
          "High-level project dashboard with task status, completion trends, and health metrics",
        category: "project",
        layout_json:
          Jason.encode!(%{
            canvas: %{name: "Project Overview", canvas_type: "dashboard"},
            elements: [
              %{
                element_type: "text",
                x: 40,
                y: 20,
                width: 400,
                height: 40,
                text: "Project Overview",
                style: %{fontSize: 22, fontWeight: "bold"}
              },
              %{
                element_type: "pie_chart",
                x: 40,
                y: 80,
                width: 280,
                height: 280,
                text: "Task Status",
                data_source: "tasks:by_status",
                refresh_interval: 30
              },
              %{
                element_type: "line_chart",
                x: 360,
                y: 80,
                width: 400,
                height: 280,
                text: "Completion Trend",
                data_source: "tasks:completed_over_time",
                refresh_interval: 120
              },
              %{
                element_type: "number_card",
                x: 40,
                y: 400,
                width: 200,
                height: 120,
                text: "Responsibility Health",
                data_source: "responsibilities:health",
                refresh_interval: 120
              },
              %{
                element_type: "number_card",
                x: 280,
                y: 400,
                width: 200,
                height: 120,
                text: "Habits",
                data_source: "habits:completion_rate",
                refresh_interval: 120
              }
            ]
          })
      },
      %{
        id: "tpl_brainstorm",
        name: "Brainstorm",
        description: "Freeform brainstorming space with sticky notes and connection areas",
        category: "brainstorm",
        layout_json:
          Jason.encode!(%{
            canvas: %{name: "Brainstorm", canvas_type: "freeform"},
            elements: [
              %{
                element_type: "text",
                x: 300,
                y: 20,
                width: 300,
                height: 40,
                text: "Brainstorm",
                style: %{fontSize: 22, fontWeight: "bold"}
              },
              %{
                element_type: "ellipse",
                x: 320,
                y: 160,
                width: 260,
                height: 260,
                text: "Core Idea",
                style: %{fill: "rgba(94, 234, 212, 0.1)", stroke: "#5eead4"}
              },
              %{
                element_type: "sticky",
                x: 40,
                y: 100,
                width: 200,
                height: 120,
                text: "Thought 1",
                style: %{color: "#fbbf24"}
              },
              %{
                element_type: "sticky",
                x: 40,
                y: 260,
                width: 200,
                height: 120,
                text: "Thought 2",
                style: %{color: "#60a5fa"}
              },
              %{
                element_type: "sticky",
                x: 660,
                y: 100,
                width: 200,
                height: 120,
                text: "Thought 3",
                style: %{color: "#a78bfa"}
              },
              %{
                element_type: "sticky",
                x: 660,
                y: 260,
                width: 200,
                height: 120,
                text: "Thought 4",
                style: %{color: "#f87171"}
              },
              %{
                element_type: "sticky",
                x: 200,
                y: 460,
                width: 200,
                height: 120,
                text: "Action Item",
                style: %{color: "#34d399"}
              },
              %{
                element_type: "sticky",
                x: 500,
                y: 460,
                width: 200,
                height: 120,
                text: "Action Item",
                style: %{color: "#34d399"}
              }
            ]
          })
      }
    ]
  end
end
