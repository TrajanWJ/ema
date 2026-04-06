import { useUIStore, type PageName } from "../../store/uiStore";

const items: Array<{ page: PageName; icon: string; label: string; color: string }> = [
  { page: "dashboard", icon: "⊹", label: "Dashboard", color: "var(--accent)" },
  { page: "projects", icon: "📁", label: "Projects", color: "var(--green)" },
  { page: "executions", icon: "⚡", label: "Executions", color: "var(--purple)" },
  { page: "agents", icon: "🤖", label: "Agents", color: "var(--orange)" },
  { page: "braindump", icon: "💭", label: "Brain Dump", color: "var(--pink)" }
];

export function Sidebar() {
  const { sidebarOpen, activePage, setPage, toggleSidebar } = useUIStore();
  return (
    <div
      style={{
        position: "fixed",
        top: 36,
        left: 0,
        height: "calc(100vh - 36px)",
        width: sidebarOpen ? 190 : 54,
        transition: "width 0.2s ease",
        background: "rgba(9,12,22,0.92)",
        backdropFilter: "blur(16px)",
        borderRight: "1px solid var(--border)",
        zIndex: 90,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}
    >
      <div className="card-list">
        <button className="sidebar-item" style={{ padding: sidebarOpen ? "8px 10px" : "8px 0", justifyContent: sidebarOpen ? "flex-start" : "center" }} onClick={toggleSidebar}>
          <span style={{ color: "var(--accent)" }}>◈</span>
          {sidebarOpen && <strong>HQ</strong>}
        </button>
        {items.map((item) => {
          const active = item.page === activePage;
          return (
            <button
              key={item.page}
              className={`sidebar-item ${active ? "active" : ""}`}
              onClick={() => setPage(item.page)}
              style={{
                padding: sidebarOpen ? "8px 10px" : "8px 0",
                justifyContent: sidebarOpen ? "flex-start" : "center",
                background: active ? `${item.color}18` : "transparent",
                borderColor: active ? `${item.color}30` : "transparent",
                color: active ? item.color : "var(--text)"
              }}
            >
              <span>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          );
        })}
      </div>
      <div className="row" style={{ justifyContent: sidebarOpen ? "flex-start" : "center" }}>
        <span className="status-dot" style={{ background: "var(--green)" }} />
        {sidebarOpen && <span>Agent online</span>}
      </div>
    </div>
  );
}
