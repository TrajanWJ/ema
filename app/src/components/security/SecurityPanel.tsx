export function SecurityPanelApp() {
  return (
    <div className="flex flex-col gap-4 p-6 h-full">
      <h1 className="text-lg font-semibold" style={{ color: "rgba(255,255,255,0.87)" }}>
        Security Posture
      </h1>
      <div className="text-sm" style={{ color: "var(--pn-text-tertiary)" }}>Loading...</div>
    </div>
  );
}
