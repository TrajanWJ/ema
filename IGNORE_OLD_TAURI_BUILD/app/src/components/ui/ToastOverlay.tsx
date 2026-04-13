import { useNotificationStore } from "@/stores/notification-store";
import type { Toast } from "@/stores/notification-store";

const VARIANT_STYLES: Record<Toast["variant"], { bg: string; border: string; color: string }> = {
  success: { bg: "rgba(45,212,168,0.12)", border: "rgba(45,212,168,0.25)", color: "#2dd4a8" },
  error: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)", color: "#ef4444" },
  info: { bg: "rgba(107,149,240,0.12)", border: "rgba(107,149,240,0.25)", color: "#6b95f0" },
};

export function ToastOverlay() {
  const toasts = useNotificationStore((s) => s.toasts);
  const dismiss = useNotificationStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 16,
      right: 16,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      pointerEvents: "none",
    }}>
      {toasts.map((t) => {
        const s = VARIANT_STYLES[t.variant];
        return (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            style={{
              pointerEvents: "auto",
              cursor: "pointer",
              background: s.bg,
              border: `1px solid ${s.border}`,
              borderRadius: 8,
              padding: "10px 16px",
              color: s.color,
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              backdropFilter: "blur(12px)",
              maxWidth: 360,
              animation: "toastSlideIn 200ms ease-out",
            }}
          >
            {t.message}
          </div>
        );
      })}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
