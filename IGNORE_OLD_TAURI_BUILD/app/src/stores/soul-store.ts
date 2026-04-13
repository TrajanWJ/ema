import { create } from "zustand";

export interface SoulVersion {
  readonly id: string;
  readonly version: number;
  readonly content: string;
  readonly timestamp: string;
  readonly testResult: TestResult | null;
}

export interface TestResult {
  readonly score: number;
  readonly passed: boolean;
  readonly details: readonly string[];
}

interface SoulState {
  readonly content: string;
  readonly versions: readonly SoulVersion[];
  readonly activeVersionId: string | null;
  readonly saving: boolean;
  readonly testing: boolean;
  readonly deploying: boolean;
  readonly testResult: TestResult | null;
  readonly testPanelOpen: boolean;

  setContent: (content: string) => void;
  save: () => Promise<void>;
  test: () => Promise<void>;
  deploy: () => Promise<void>;
  loadVersion: (id: string) => void;
  toggleTestPanel: () => void;
}

const DEFAULT_SOUL = `# SOUL.md

## Identity
You are EMA — an Executive Management Assistant.

## Personality
- Direct and concise
- Honest over agreeable
- Action-oriented

## Values
- Clarity over cleverness
- Ship over perfect
- User autonomy always

## Boundaries
- Never fabricate data
- Admit uncertainty explicitly
- Challenge bad premises
`;

function generateId(): string {
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useSoulStore = create<SoulState>((set, get) => ({
  content: DEFAULT_SOUL,
  versions: [],
  activeVersionId: null,
  saving: false,
  testing: false,
  deploying: false,
  testResult: null,
  testPanelOpen: false,

  setContent(content: string) {
    set({ content });
  },

  async save() {
    set({ saving: true });
    const { content, versions } = get();
    const nextVersion = versions.length + 1;
    const version: SoulVersion = {
      id: generateId(),
      version: nextVersion,
      content,
      timestamp: new Date().toISOString(),
      testResult: null,
    };
    set({
      versions: [version, ...versions],
      activeVersionId: version.id,
      saving: false,
    });
  },

  async test() {
    set({ testing: true, testPanelOpen: true });
    const { content } = get();

    // Simulate scoring based on content analysis
    await new Promise((r) => setTimeout(r, 1200));

    const details: string[] = [];
    let score = 5.0;

    if (content.includes("# ")) {
      score += 1.0;
      details.push("✓ Has structured headings");
    } else {
      details.push("✗ Missing structured headings");
    }

    if (content.includes("Identity") || content.includes("identity")) {
      score += 1.0;
      details.push("✓ Identity section defined");
    } else {
      details.push("✗ No identity section");
    }

    if (content.includes("Boundaries") || content.includes("boundaries")) {
      score += 1.0;
      details.push("✓ Boundaries defined");
    } else {
      details.push("✗ No boundaries section");
    }

    if (content.length > 200) {
      score += 0.5;
      details.push("✓ Sufficient detail (>" + "200 chars)");
    } else {
      details.push("✗ Content too brief");
    }

    if (content.includes("Values") || content.includes("values")) {
      score += 0.5;
      details.push("✓ Values articulated");
    } else {
      details.push("✗ No values section");
    }

    score = Math.min(10, Math.round(score * 10) / 10);
    const passed = score >= 7.0;

    const result: TestResult = { score, passed, details };

    set((state) => {
      const { activeVersionId, versions } = state;
      const updated = versions.map((v) =>
        v.id === activeVersionId ? { ...v, testResult: result } : v,
      );
      return { testing: false, testResult: result, versions: updated };
    });
  },

  async deploy() {
    const { testResult } = get();
    if (!testResult || testResult.score < 7.0) return;

    set({ deploying: true });
    await new Promise((r) => setTimeout(r, 800));
    set({ deploying: false });
  },

  loadVersion(id: string) {
    const version = get().versions.find((v) => v.id === id);
    if (version) {
      set({
        content: version.content,
        activeVersionId: version.id,
        testResult: version.testResult,
      });
    }
  },

  toggleTestPanel() {
    set((state) => ({ testPanelOpen: !state.testPanelOpen }));
  },
}));
