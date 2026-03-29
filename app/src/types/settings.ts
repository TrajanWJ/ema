export interface AppSettings {
  readonly color_mode: "dark" | "light" | "auto";
  readonly accent_color: string;
  readonly glass_intensity: string;
  readonly font_family: string;
  readonly font_size: string;
  readonly launch_on_boot: string;
  readonly start_minimized: string;
  readonly shortcut_capture: string;
  readonly shortcut_toggle: string;
  [key: string]: string;
}
