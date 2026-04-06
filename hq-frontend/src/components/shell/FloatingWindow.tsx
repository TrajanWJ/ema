import { useEffect, useRef, useState } from "react";
import { useUIStore, type FloatingWindowState } from "../../store/uiStore";

interface FloatingWindowProps {
  windowState: FloatingWindowState;
  children: React.ReactNode;
}

export function FloatingWindow({ windowState, children }: FloatingWindowProps) {
  const { closeFloat, bringToFront, moveFloat } = useUIStore();
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: MouseEvent) => {
      moveFloat(windowState.id, event.clientX - offsetRef.current.x, event.clientY - offsetRef.current.y);
    };
    const onUp = () => setDragging(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, moveFloat, windowState.id]);

  return (
    <div
      className="glass floating-window"
      style={{ left: windowState.x, top: windowState.y, width: windowState.w, height: windowState.h, zIndex: windowState.z }}
      onMouseDown={() => bringToFront(windowState.id)}
    >
      <div
        className="floating-title"
        onMouseDown={(event) => {
          setDragging(true);
          offsetRef.current = { x: event.clientX - windowState.x, y: event.clientY - windowState.y };
        }}
      >
        <div className="traffic">
          <button style={{ background: "#ff5f57" }} onClick={() => closeFloat(windowState.id)} />
          <button style={{ background: "#febc2e" }} />
          <button style={{ background: "#28c840" }} />
        </div>
        <div className="row">
          <span>🪟</span>
          <span>{windowState.title}</span>
        </div>
        <span className="badge">floating</span>
      </div>
      <div style={{ height: `calc(100% - 36px)`, overflow: "auto", padding: 14 }}>{children}</div>
    </div>
  );
}
