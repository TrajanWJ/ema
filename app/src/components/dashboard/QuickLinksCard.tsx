import { GlassCard } from "@/components/ui/GlassCard";

type Page = "dashboard" | "brain-dump" | "habits" | "journal" | "settings";

interface QuickLinksCardProps {
  readonly onNavigate: (page: Page) => void;
  readonly onCapture: () => void;
}

const LINKS = [
  { id: "capture", icon: "\u25CE", label: "New Capture", page: null },
  { id: "journal", icon: "\u270E", label: "Today's Journal", page: "journal" as const },
  { id: "vault", icon: "\u2315", label: "Vault Search", page: null, disabled: true },
  { id: "settings", icon: "\u2699", label: "Settings", page: "settings" as const },
] as const;

export function QuickLinksCard({ onNavigate, onCapture }: QuickLinksCardProps) {
  return (
    <GlassCard title="Quick Links">
      <div className="grid grid-cols-2 gap-2">
        {LINKS.map((link) => {
          const disabled = "disabled" in link && link.disabled;
          return (
            <button
              key={link.id}
              onClick={() => {
                if (disabled) return;
                if (link.id === "capture") {
                  onCapture();
                  return;
                }
                if (link.page) onNavigate(link.page);
              }}
              disabled={disabled}
              className="flex flex-col items-center justify-center gap-1 rounded-lg transition-colors"
              style={{
                width: "100%",
                height: "44px",
                background: "var(--glass-ambient-bg, rgba(255,255,255,0.03))",
                color: disabled
                  ? "var(--pn-text-muted)"
                  : "var(--pn-text-secondary)",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <span className="text-[0.9rem]">{link.icon}</span>
              <span className="text-[0.6rem]">{link.label}</span>
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}
