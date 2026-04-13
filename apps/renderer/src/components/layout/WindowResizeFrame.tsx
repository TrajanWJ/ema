import { useEffect, useState } from "react";

import {
  endWindowResize,
  isDesktopEnvironment,
  isWindowResizeSupported,
  startWindowResize,
  type WindowResizeEdge,
  updateWindowResize,
} from "@/lib/electron-bridge";

const HANDLE_LAYOUT: ReadonlyArray<{ edge: WindowResizeEdge; className: string; cursor: string }> = [
  { edge: "top", className: "ema-window-resize-handle ema-window-resize-handle--top", cursor: "ns-resize" },
  { edge: "right", className: "ema-window-resize-handle ema-window-resize-handle--right", cursor: "ew-resize" },
  { edge: "bottom", className: "ema-window-resize-handle ema-window-resize-handle--bottom", cursor: "ns-resize" },
  { edge: "left", className: "ema-window-resize-handle ema-window-resize-handle--left", cursor: "ew-resize" },
  {
    edge: "top-left",
    className: "ema-window-resize-handle ema-window-resize-handle--top-left",
    cursor: "nwse-resize",
  },
  {
    edge: "top-right",
    className: "ema-window-resize-handle ema-window-resize-handle--top-right",
    cursor: "nesw-resize",
  },
  {
    edge: "bottom-left",
    className: "ema-window-resize-handle ema-window-resize-handle--bottom-left",
    cursor: "nesw-resize",
  },
  {
    edge: "bottom-right",
    className: "ema-window-resize-handle ema-window-resize-handle--bottom-right",
    cursor: "nwse-resize",
  },
];

interface WindowResizeFrameProps {
  readonly enabled?: boolean;
}

export function WindowResizeFrame({ enabled = true }: WindowResizeFrameProps) {
  const [activeHandle, setActiveHandle] = useState<(typeof HANDLE_LAYOUT)[number] | null>(null);
  const supported = enabled && isDesktopEnvironment() && isWindowResizeSupported();

  useEffect(() => {
    if (!activeHandle) return;

    function handleMove(event: PointerEvent) {
      updateWindowResize(event.screenX, event.screenY);
    }

    function stopResize() {
      endWindowResize();
      setActiveHandle(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = activeHandle.cursor;
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
    window.addEventListener("blur", stopResize);

    return () => {
      endWindowResize();
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      window.removeEventListener("blur", stopResize);
    };
  }, [activeHandle]);

  if (!supported) {
    return null;
  }

  return (
    <div className="ema-window-resize-frame" aria-hidden="true">
      {HANDLE_LAYOUT.map((handle) => (
        <div
          key={handle.edge}
          className={handle.className}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            void startWindowResize(handle.edge, event.screenX, event.screenY).then((started) => {
              if (started) {
                setActiveHandle(handle);
              }
            });
          }}
        />
      ))}
    </div>
  );
}
