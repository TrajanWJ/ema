/**
 * Electron IPC bridge — replaces all @tauri-apps/* imports.
 * In Electron, window.ema is exposed via the preload script (contextBridge).
 * In browser dev mode (no Electron), gracefully degrades to no-ops.
 */

interface ElectronBridge {
  openApp(appId: string): Promise<void>;
  closeApp(appId: string): Promise<void>;
  minimize(): void;
  maximize(): void;
  close(): void;
  onNavigate(callback: (appId: string) => void): () => void;
  platform: string;
}

declare global {
  interface Window {
    ema?: ElectronBridge;
  }
}

export function isDesktopEnvironment(): boolean {
  return typeof window !== "undefined" && window.ema !== undefined;
}

function getBridge(): ElectronBridge | null {
  if (typeof window === "undefined") return null;
  return window.ema ?? null;
}

export async function minimizeWindow(): Promise<void> {
  getBridge()?.minimize();
}

export async function maximizeWindow(): Promise<void> {
  getBridge()?.maximize();
}

export async function closeWindow(): Promise<void> {
  getBridge()?.close();
}

export async function openAppWindow(appId: string): Promise<void> {
  await getBridge()?.openApp(appId);
}

export async function closeAppWindow(appId: string): Promise<void> {
  await getBridge()?.closeApp(appId);
}

export function getPlatform(): string {
  return getBridge()?.platform ?? "browser";
}
