interface StatCardsProps {
  running: number;
  projects: number;
  brainDump: number;
  completedToday: number;
}

function Card({ label, value, color, sub }: { label: string; value: number; color: string; sub: string }) {
  return (
    <div className="glass panel">
      <div className="muted" style={{ fontSize: 10, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, marginTop: 6 }}>{value}</div>
      <div className="dim" style={{ fontSize: 10, marginTop: 6 }}>{sub}</div>
    </div>
  );
}

export function StatCards(props: StatCardsProps) {
  return (
    <div className="stat-grid">
      <Card label="Running" value={props.running} color="var(--accent)" sub="Active agents now" />
      <Card label="Projects" value={props.projects} color="var(--green)" sub="Tracked workspaces" />
      <Card label="Brain Dump" value={props.brainDump} color="var(--orange)" sub="Unprocessed captures" />
      <Card label="Completed Today" value={props.completedToday} color="var(--purple)" sub="Finished executions" />
    </div>
  );
}
