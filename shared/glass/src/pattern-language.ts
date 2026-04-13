import { patternLanguage } from "@ema/tokens";
import { vAppRecipes, vAppRegistry } from "./app-specs.ts";

export const componentRecipes = {
  nav: [
    {
      id: "top_nav_workspace",
      components: ["TopNavBar", "SegmentedControl", "SectionHeader"],
      best_for: "Switching between 2 to 5 major surfaces in a workspace app.",
    },
    {
      id: "sidebar_hierarchy",
      components: ["SidebarNav", "SectionHeader"],
      best_for: "Apps with deeper section trees or saved views.",
    },
  ],
  views: [
    {
      id: "spotlight_stream",
      components: ["SectionHeader", "MetricCard", "BentoGrid"],
      best_for: "Feed, newsroom, or discovery surfaces.",
    },
    {
      id: "command_dashboard",
      components: ["SectionHeader", "MetricCard", "BentoGrid"],
      best_for: "HQ, orchestration, monitoring, or service summary apps.",
    },
  ],
  templates: [
    {
      id: "workspace_shell",
      component: "WorkspaceShell",
      best_for: "Apps with a strong top nav, main flow, and right rail.",
    },
    {
      id: "command_center_shell",
      component: "CommandCenterShell",
      best_for: "Apps that need top-level routing, hero context, metrics, and an activity rail.",
    },
    {
      id: "feed_shell",
      component: "FeedShell",
      best_for: "Discovery and media surfaces with a spotlight item, stream, inspector, and rail.",
    },
    {
      id: "studio_shell",
      component: "StudioShell",
      best_for: "Creation or tuning apps with a dominant canvas and inspector.",
    },
  ],
  framework: {
    recipes: vAppRecipes,
    registry: vAppRegistry,
  },
  language: patternLanguage,
} as const;

export type ComponentRecipes = typeof componentRecipes;
