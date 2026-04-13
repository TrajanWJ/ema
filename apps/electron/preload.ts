import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ema", {
  openApp: (appId: string): Promise<void> =>
    ipcRenderer.invoke("ema:open-app", appId),

  closeApp: (appId: string): Promise<void> =>
    ipcRenderer.invoke("ema:close-app", appId),

  startWindowResize: (
    edge: string,
    screenX: number,
    screenY: number,
  ): Promise<boolean> => ipcRenderer.invoke("ema:window-resize-start", { edge, screenX, screenY }),

  updateWindowResize: (screenX: number, screenY: number): void => {
    ipcRenderer.send("ema:window-resize-update", { screenX, screenY });
  },

  endWindowResize: (): void => {
    ipcRenderer.send("ema:window-resize-end");
  },

  minimize: (): void => {
    ipcRenderer.send("ema:minimize");
  },

  maximize: (): void => {
    ipcRenderer.send("ema:maximize");
  },

  close: (): void => {
    ipcRenderer.send("ema:close");
  },

  onNavigate: (callback: (appId: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, appId: string) => callback(appId);
    ipcRenderer.on("ema:navigate", listener);
    return () => {
      ipcRenderer.removeListener("ema:navigate", listener);
    };
  },

  appearance: {
    platform: process.platform,
    transparencyMode:
      process.platform === "darwin"
        ? "native-vibrancy"
        : process.platform === "win32"
          ? "native-material"
          : "simulated-glass",
    nativeWindowEffects: process.platform === "darwin" || process.platform === "win32",
    customChrome: true,
  },

  platform: process.platform,
});
