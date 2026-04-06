#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod origin_check;
mod protocol;
mod window_mgr;
mod ws_server;

use log::info;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Manager,
};
#[cfg(target_os = "windows")]
use tauri_plugin_autostart::ManagerExt as _;
use tokio::sync::Mutex;
use window_mgr::WindowManager;

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .invoke_handler(tauri::generate_handler![commands::reattach])
        .setup(|app| {
            // macOS: hide dock icon — tray-only background app
            #[cfg(target_os = "macos")]
            let _ = app.handle().set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Windows: re-enable autostart on every launch.
            // Workaround for tauri-plugins-workspace#771 where the registry
            // entry is removed after one reboot.
            #[cfg(target_os = "windows")]
            {
                let mgr = app.autolaunch();
                if mgr.is_enabled().unwrap_or(false) {
                    let _ = mgr.enable();
                }
            }

            let wm = Arc::new(Mutex::new(WindowManager::new(app.handle().clone())));

            // Create reattach broadcast channel (IPC commands → WS server)
            let (reattach_tx, _) = tokio::sync::broadcast::channel::<commands::ReattachEvent>(16);
            app.manage(reattach_tx.clone()); // for commands::reattach State access
            app.manage(ws_server::SharedWindowManager::clone(&wm));

            // Start WebSocket server
            let wm_clone = wm.clone();
            let app_handle = app.handle().clone();
            let reattach_tx_clone = reattach_tx.clone();
            tauri::async_runtime::spawn(async move {
                match ws_server::run_server(wm_clone, reattach_tx_clone).await {
                    Ok(port) => {
                        info!("Companion ready on port {port}");
                        // Update tray tooltip with port
                        if let Some(tray) = app_handle.tray_by_id("main-tray") {
                            let _ = tray.set_tooltip(Some(
                                &format!("place.org Companion — port {port}"),
                            ));
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to start WebSocket server: {e}");
                    }
                }
            });

            // System tray
            let open = MenuItemBuilder::with_id("open", "Open place.org").build(app)?;
            let close_all = MenuItemBuilder::with_id("close-all", "Close All Windows").build(app)?;
            let separator1 = PredefinedMenuItem::separator(app)?;
            let autostart = MenuItemBuilder::with_id("autostart", "Start at Login").build(app)?;
            let separator2 = PredefinedMenuItem::separator(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

            let menu = Menu::with_items(
                app,
                &[&open, &close_all, &separator1, &autostart, &separator2, &quit],
            )?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("place.org Companion")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event({
                    let wm = wm.clone();
                    move |app, event| match event.id().as_ref() {
                        "quit" => app.exit(0),
                        "open" => {
                            let _ = open::that("https://place.org");
                        }
                        "close-all" => {
                            let wm = wm.clone();
                            tauri::async_runtime::spawn(async move {
                                let mut mgr = wm.lock().await;
                                mgr.close_all();
                            });
                        }
                        "autostart" => {
                            tauri::async_runtime::spawn(async {
                                log::info!("Autostart toggle requested");
                            });
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            info!("place-companion started");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running place-companion");
}
