/**
 * Electron IPC bridge — replaces all @tauri-apps/* imports.
 * In Electron, window.ema is exposed via the preload script (contextBridge).
 * In browser dev mode (no Electron), gracefully degrades to no-ops.
 */

export interface ElectronAppearance {
  platform: string;
  transparencyMode: string;
  nativeWindowEffects: boolean;
  customChrome: boolean;
}

export type WindowResizeEdge =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

interface ElectronBridge {
  openApp(appId: string): Promise<void>;
  closeApp(appId: string): Promise<void>;
  startWindowResize(edge: WindowResizeEdge, screenX: number, screenY: number): Promise<boolean>;
  updateWindowResize(screenX: number, screenY: number): void;
  endWindowResize(): void;
  minimize(): void;
  maximize(): void;
  close(): void;
  onNavigate(callback: (appId: string) => void): () => void;
  appearance: ElectronAppearance;
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

export async function startWindowResize(
  edge: WindowResizeEdge,
  screenX: number,
  screenY: number,
): Promise<boolean> {
  return (await getBridge()?.startWindowResize(edge, screenX, screenY)) ?? false;
}

export function updateWindowResize(screenX: number, screenY: number): void {
  getBridge()?.updateWindowResize(screenX, screenY);
}

export function endWindowResize(): void {
  getBridge()?.endWindowResize();
}

export function isWindowResizeSupported(): boolean {
  return getBridge() !== null;
}

export function getPlatform(): string {
  return getBridge()?.platform ?? "browser";
}

export function getAppearance(): ElectronAppearance {
  return getBridge()?.appearance ?? {
    platform: "browser",
    transparencyMode: "simulated-glass",
    nativeWindowEffects: false,
    customChrome: false,
  };
}
