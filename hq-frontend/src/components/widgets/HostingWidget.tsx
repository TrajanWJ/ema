import { useProjectStore } from "../../store/projectStore";

export function HostingWidget() {
  const resources = useProjectStore((state) => state.activeProjectContext?.resources || []);

  return (
    <div className="card-list">
      {resources.length === 0 ? (
        <div className="muted">No hosting resources linked</div>
      ) : (
        resources.map((resource) => (
          <div key={resource.id} className="card row-between">
            <div>
              <div>{resource.label}</div>
              <div className="muted">{resource.type}</div>
            </div>
            {resource.url ? <a href={resource.url} target="_blank" rel="noreferrer">Open</a> : <span className="dim">No URL</span>}
          </div>
        ))
      )}
    </div>
  );
}
