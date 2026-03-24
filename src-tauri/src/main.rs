#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod commands;
mod origin_check;
mod protocol;
mod window_mgr;

fn main() {
    env_logger::init();
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .run(tauri::generate_context!())
        .expect("error running place-companion");
}
