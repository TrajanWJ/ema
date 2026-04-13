import { patternLanguage } from "@ema/tokens";

export type VAppArchetypeId = (typeof patternLanguage.appArchetypes)[number]["id"];
export type VAppNavSystemId = (typeof patternLanguage.navigationSystems)[number]["id"];
export type VAppSectionArchetypeId =
  (typeof patternLanguage.sectionArchetypes)[number]["id"];

export interface VAppArchetypeSpec {
  id: VAppArchetypeId;
  label: string;
  use_when: string;
  default_sections: readonly string[];
}

export interface VAppShellSpec {
  id: string;
  component: string;
  best_for: string;
}

export interface VAppNavSpec {
  id: VAppNavSystemId;
  label: string;
  best_for: string;
}

export interface VAppSectionSpec {
  id: string;
  archetype: string;
  label: string;
  purpose: string;
  required?: boolean | undefined;
}

export interface VAppAtmosphereSpec {
  gradient: string;
  tone: string;
  personality: "editorial" | "operational" | "cinematic" | "calm" | "signal";
}

export interface VAppCopySpec {
  verbs: readonly string[];
  nouns: readonly string[];
  section_labels: readonly string[];
}

export interface VAppRecipe {
  id: string;
  label: string;
  shell: string;
  sections: readonly string[];
  best_for: string;
}

export interface VAppRegistryEntry {
  id: string;
  title: string;
  category: string;
  archetype: VAppArchetypeSpec;
  shell: VAppShellSpec;
  nav: VAppNavSpec;
  sections: readonly VAppSectionSpec[];
  atmosphere: VAppAtmosphereSpec;
  copy: VAppCopySpec;
  migration_status: "seed" | "partial" | "adopted";
}

const appArchetypesById = patternLanguage.appArchetypes.reduce<Record<VAppArchetypeId, VAppArchetypeSpec>>(
  (acc, entry) => {
    acc[entry.id] = entry;
    return acc;
  },
  {} as Record<VAppArchetypeId, VAppArchetypeSpec>,
);

const navSystemsById = patternLanguage.navigationSystems.reduce<Record<VAppNavSystemId, VAppNavSpec>>(
  (acc, entry) => {
    acc[entry.id] = entry;
    return acc;
  },
  {} as Record<VAppNavSystemId, VAppNavSpec>,
);

const shellSpecs = {
  workspace_shell: {
    id: "workspace_shell",
    component: "WorkspaceShell",
    best_for: "Apps with strong navigation, one main work area, and an optional right rail.",
  },
  command_center_shell: {
    id: "command_center_shell",
    component: "CommandCenterShell",
    best_for: "Operational surfaces that need hero context, metrics, and activity monitoring.",
  },
  feed_shell: {
    id: "feed_shell",
    component: "FeedShell",
    best_for: "Discovery surfaces with a spotlight item, flowing stream, inspector, and activity rail.",
  },
  studio_shell: {
    id: "studio_shell",
    component: "StudioShell",
    best_for: "Creation and tuning surfaces with a primary canvas and supporting inspector.",
  },
  inspector_workspace_shell: {
    id: "inspector_workspace_shell",
    component: "InspectorWorkspaceShell",
    best_for: "Selection-driven surfaces with a strong persistent inspector and flexible content area.",
  },
  catalog_shell: {
    id: "catalog_shell",
    component: "CatalogShell",
    best_for: "Framework catalogs, galleries, and reference surfaces with browse and detail panes.",
  },
  monitor_shell: {
    id: "monitor_shell",
    component: "MonitorShell",
    best_for: "Status-first operational views with summary strips, health grids, and event rails.",
  },
} as const satisfies Record<string, VAppShellSpec>;

const defaultCopy: VAppCopySpec = {
  verbs: patternLanguage.copyGuidance.preferredVerbs,
  nouns: patternLanguage.copyGuidance.preferredNouns,
  section_labels: patternLanguage.copyGuidance.sectionLabelShapes,
};

export const vAppRecipes = {
  command_center_tabs: {
    id: "command_center_tabs",
    label: "Command Center With Top Tabs",
    shell: "command_center_shell",
    sections: ["top_nav", "hero_metrics", "primary_work_area", "activity_rail"],
    best_for: "Task, operations, monitoring, and orchestration apps.",
  },
  feed_spotlight: {
    id: "feed_spotlight",
    label: "Feed Spotlight Stream",
    shell: "feed_shell",
    sections: ["top_nav", "featured_item", "stream", "algorithm_studio", "activity_rail"],
    best_for: "Media, signal, and discovery surfaces with ranking controls.",
  },
  workspace_inspector: {
    id: "workspace_inspector",
    label: "Workspace With Inspector Rail",
    shell: "workspace_shell",
    sections: ["top_nav", "hero_context", "primary_work_area", "inspector"],
    best_for: "Settings, control surfaces, and inspector-heavy utilities.",
  },
  list_detail_monitor: {
    id: "list_detail_monitor",
    label: "List Detail Monitor",
    shell: "inspector_workspace_shell",
    sections: ["subnav_filters", "entity_list", "detail_panel", "activity_rail"],
    best_for: "Projects, proposals, and queues with deep inspection needs.",
  },
} as const satisfies Record<string, VAppRecipe>;

export const vAppRegistry = {
  feeds: {
    id: "feeds",
    title: "Feeds",
    category: "intelligence",
    archetype: appArchetypesById.feed_reader,
    shell: shellSpecs.feed_shell,
    nav: navSystemsById.top_tabs,
    sections: [
      {
        id: "feed-nav",
        archetype: "top_nav",
        label: "Surface Nav",
        purpose: "Switch between reader, triage, and agent console.",
        required: true,
      },
      {
        id: "spotlight",
        archetype: "spotlight_stream",
        label: "Spotlight",
        purpose: "Show the leading ranked item and adjacent references.",
        required: true,
      },
      {
        id: "algorithm-studio",
        archetype: "algorithm_studio",
        label: "Algorithm Studio",
        purpose: "Expose prompt and ranking controls as a first-class panel.",
        required: true,
      },
      {
        id: "activity-rail",
        archetype: "activity_rail",
        label: "Activity Rail",
        purpose: "Keep actions and conversations visible without taking over the feed.",
      },
    ],
    atmosphere: {
      gradient: "editorial",
      tone: "var(--color-pn-teal-400)",
      personality: "editorial",
    },
    copy: defaultCopy,
    migration_status: "partial",
  },
  tasks: {
    id: "tasks",
    title: "Tasks",
    category: "work",
    archetype: appArchetypesById.command_center,
    shell: shellSpecs.command_center_shell,
    nav: navSystemsById.top_tabs,
    sections: [
      {
        id: "task-nav",
        archetype: "top_nav",
        label: "View Nav",
        purpose: "Switch between board and list views while keeping the queue stable.",
        required: true,
      },
      {
        id: "hero",
        archetype: "hero_metrics",
        label: "Queue Hero",
        purpose: "Surface queue posture before the user starts triaging tasks.",
        required: true,
      },
      {
        id: "status-strip",
        archetype: "hero_metrics",
        label: "Status Strip",
        purpose: "Summarize active, blocked, and review states.",
      },
      {
        id: "activity-rail",
        archetype: "activity_rail",
        label: "Recent Queue Activity",
        purpose: "Expose latest arrivals and movements in the task system.",
      },
    ],
    atmosphere: {
      gradient: "signal",
      tone: "var(--color-pn-blue-400)",
      personality: "operational",
    },
    copy: defaultCopy,
    migration_status: "adopted",
  },
  settings: {
    id: "settings",
    title: "Settings",
    category: "system",
    archetype: appArchetypesById.dashboard,
    shell: shellSpecs.workspace_shell,
    nav: navSystemsById.top_tabs,
    sections: [
      {
        id: "settings-nav",
        archetype: "top_nav",
        label: "Settings Nav",
        purpose: "Switch between system, workspace, and developer concerns.",
        required: true,
      },
      {
        id: "control-hero",
        archetype: "hero_metrics",
        label: "Control Hero",
        purpose: "Frame the workspace posture and current runtime state.",
      },
      {
        id: "inspector",
        archetype: "inspector",
        label: "Runtime Inspector",
        purpose: "Keep current settings posture and shortcuts visible.",
      },
    ],
    atmosphere: {
      gradient: "chrome",
      tone: "var(--color-pn-blue-400)",
      personality: "calm",
    },
    copy: defaultCopy,
    migration_status: "adopted",
  },
  proposals: {
    id: "proposals",
    title: "Proposals",
    category: "intelligence",
    archetype: appArchetypesById.list_detail,
    shell: shellSpecs.inspector_workspace_shell,
    nav: navSystemsById.segmented_toolbar,
    sections: [
      {
        id: "proposal-nav",
        archetype: "subnav_filters",
        label: "Proposal Nav",
        purpose: "Switch between queue, lineage, evolution, seeds, scores, and engine views.",
        required: true,
      },
      {
        id: "proposal-work",
        archetype: "primary_work_area",
        label: "Proposal Surface",
        purpose: "Expose the active proposal view with enough room for inspection and comparison.",
      },
      {
        id: "proposal-rail",
        archetype: "activity_rail",
        label: "Proposal Rail",
        purpose: "Keep engine posture, seeds, and creation constraints visible.",
      },
    ],
    atmosphere: {
      gradient: "theater",
      tone: "var(--color-pn-purple-400)",
      personality: "signal",
    },
    copy: defaultCopy,
    migration_status: "partial",
  },
  "pattern-lab": {
    id: "pattern-lab",
    title: "Pattern Lab",
    category: "system",
    archetype: appArchetypesById.dashboard,
    shell: shellSpecs.catalog_shell,
    nav: navSystemsById.top_tabs,
    sections: [
      {
        id: "catalog-nav",
        archetype: "top_nav",
        label: "Catalog Nav",
        purpose: "Switch between components, templates, and token language.",
        required: true,
      },
      {
        id: "catalog-sidebar",
        archetype: "inspector",
        label: "Pattern Areas",
        purpose: "Browse framework categories and examples.",
      },
      {
        id: "catalog-content",
        archetype: "bento_grid",
        label: "Framework Catalog",
        purpose: "Expose the component and recipe system as a browseable reference surface.",
      },
    ],
    atmosphere: {
      gradient: "ocean",
      tone: "var(--color-pn-blue-400)",
      personality: "signal",
    },
    copy: defaultCopy,
    migration_status: "adopted",
  },
} as const satisfies Record<string, VAppRegistryEntry>;

export function getVAppRegistryEntry(id: string): VAppRegistryEntry | null {
  return vAppRegistry[id as keyof typeof vAppRegistry] ?? null;
}
