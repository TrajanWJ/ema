/**
 * UI pattern language and prompt vocabulary.
 *
 * This exists primarily to make both humans and LLMs more precise when they
 * ask for EMA interfaces. The goal is a shared naming layer between design,
 * implementation, and prompting.
 */

export const patternLanguage = {
  appArchetypes: [
    {
      id: "command_center",
      label: "Command Center",
      use_when:
        "The app coordinates multiple systems, queues, or actors and needs a strong overview plus routing controls.",
      default_sections: ["top_nav", "hero_metrics", "primary_work_area", "activity_rail"],
    },
    {
      id: "studio",
      label: "Studio",
      use_when:
        "The user is shaping, tuning, or composing something and needs a focused main canvas with supporting inspectors.",
      default_sections: ["top_nav", "hero_context", "main_canvas", "inspector", "history_rail"],
    },
    {
      id: "list_detail",
      label: "List Detail",
      use_when:
        "The app is selection-driven and the user needs to move through many entities with a stable inspector.",
      default_sections: ["subnav_filters", "entity_list", "detail_panel"],
    },
    {
      id: "feed_reader",
      label: "Feed Reader",
      use_when:
        "The app prioritizes discovery, ranking, and sequence, often mixing media with context and action affordances.",
      default_sections: ["top_nav", "featured_item", "stream", "algorithm_studio", "activity_rail"],
    },
    {
      id: "dashboard",
      label: "Dashboard",
      use_when:
        "The app surfaces snapshots, KPIs, and decision-ready summaries rather than one dominant workflow.",
      default_sections: ["hero_metrics", "bento_grid", "status_strip"],
    },
    {
      id: "editor",
      label: "Editor",
      use_when:
        "The app revolves around text, code, or structured authoring and benefits from calm framing and minimal chrome.",
      default_sections: ["titlebar", "document_header", "editor", "inspector_or_outline"],
    },
  ],
  navigationSystems: [
    {
      id: "top_tabs",
      label: "Top Tabs",
      best_for:
        "A small number of peer surfaces like Reader, Triage, Agent Console.",
      strengths: ["fast switching", "high visibility", "good for desktop"],
      avoid_when: "There are many levels of hierarchy or more than 6 persistent modes.",
    },
    {
      id: "left_rail",
      label: "Left Rail",
      best_for:
        "Deep apps with many sections, saved views, or nested work areas.",
      strengths: ["persistent hierarchy", "room for labels", "works with inspectors"],
      avoid_when: "The app is media-first and needs maximum horizontal space.",
    },
    {
      id: "segmented_toolbar",
      label: "Segmented Toolbar",
      best_for:
        "Contextual switches inside one app section, usually 2 to 5 tightly related modes.",
      strengths: ["compact", "clear active state", "easy to pair with filters"],
      avoid_when: "Each segment needs large descriptions or secondary actions.",
    },
    {
      id: "view_pills",
      label: "View Pills",
      best_for:
        "Saved perspectives, scopes, or filters that behave like soft tabs.",
      strengths: ["lightweight", "expressive labels", "good for promptable views"],
      avoid_when: "The set is long or needs nested grouping.",
    },
  ],
  sectionArchetypes: [
    {
      id: "hero_metrics",
      label: "Hero Metrics",
      purpose: "Set the stakes and summarize the system before the user dives in.",
    },
    {
      id: "algorithm_studio",
      label: "Algorithm Studio",
      purpose: "Expose prompt, ranking, or logic controls as a first-class surface instead of burying them in settings.",
    },
    {
      id: "activity_rail",
      label: "Activity Rail",
      purpose: "Keep recent changes, actions, and conversations visible without stealing the main flow.",
    },
    {
      id: "inspector",
      label: "Inspector",
      purpose: "Hold metadata, tuning controls, and secondary operations for the selected object.",
    },
    {
      id: "bento_grid",
      label: "Bento Grid",
      purpose: "Compose varied summaries and modules with different visual weights.",
    },
    {
      id: "spotlight_stream",
      label: "Spotlight Stream",
      purpose: "Combine one emphasized item with a flowing list beneath it.",
    },
  ],
  copyGuidance: {
    ideals: [
      "Use action-first labels",
      "Prefer concrete nouns over abstract buzzwords",
      "Expose system posture, not marketing fluff",
      "Let sections explain what kind of work happens there",
    ],
    preferredVerbs: [
      "Route",
      "Promote",
      "Triage",
      "Draft",
      "Inspect",
      "Tune",
      "Collect",
      "Review",
      "Share",
      "Queue",
      "Focus",
      "Expand",
    ],
    preferredNouns: [
      "Signal",
      "View",
      "Queue",
      "Workspace",
      "Surface",
      "Inspector",
      "Rail",
      "Flow",
      "Session",
      "Pattern",
      "Prompt",
      "Scope",
    ],
    avoid: [
      "Revolutionary",
      "Seamless",
      "Next-gen",
      "Magic",
      "Synergy",
      "Leverage as filler",
      "AI slop phrasing",
    ],
    sectionLabelShapes: [
      "Verb + object",
      "Concrete noun + qualifier",
      "System metaphor with a real operational meaning",
    ],
  },
  promptingHints: {
    for_llms: [
      "Name the app archetype first",
      "Name the navigation system explicitly",
      "Describe the primary section and the supporting rail",
      "Call out visual direction with named gradients or tones",
      "Specify if the layout should feel editorial, operational, cinematic, or calm",
    ],
    examples: [
      "Build a command_center with top_tabs, a hero_metrics strip, and an activity_rail.",
      "Use the studio archetype with a spotlight_stream and algorithm_studio inspector.",
      "Design a feed_reader with editorial atmosphere and view_pills for scopes.",
    ],
  },
} as const;

export type PatternLanguage = typeof patternLanguage;
