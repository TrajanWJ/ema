import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ema", {
  openApp: (appId: string): Promise<void> =>
    ipcRenderer.invoke("ema:open-app", appId),

  closeApp: (appId: string): Promise<void> =>
    ipcRenderer.invoke("ema:close-app", appId),

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

  platform: process.platform,
});
