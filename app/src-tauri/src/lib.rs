use std::env;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use tauri::{
    Manager, RunEvent,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

/// Resolve the daemon directory (project_root/daemon).
/// Uses CARGO_MANIFEST_DIR at compile time: src-tauri -> app -> project root.
fn daemon_dir() -> PathBuf {
    // Allow override via env var for flexibility
    if let Ok(dir) = env::var("EMA_DAEMON_DIR") {
        return PathBuf::from(dir);
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent() // app/
        .and_then(|p| p.parent()) // project root
        .expect("cannot resolve project root")
        .join("daemon")
}

/// Build PATH that includes mise-managed Erlang/Elixir if present.
fn build_path() -> String {
    let home = env::var("HOME").unwrap_or_default();
    let mise_base = format!("{home}/.local/share/mise/installs");
    let current_path = env::var("PATH").unwrap_or_default();

    // Collect mise shims and any erlang/elixir install dirs
    let mut extra_dirs: Vec<String> = Vec::new();

    // mise shims (covers most cases)
    let shims = format!("{home}/.local/share/mise/shims");
    if std::path::Path::new(&shims).is_dir() {
        extra_dirs.push(shims);
    }

    // Scan for specific erlang/elixir installs under mise
    for lang in &["erlang", "elixir"] {
        let lang_dir = format!("{mise_base}/{lang}");
        if let Ok(entries) = std::fs::read_dir(&lang_dir) {
            for entry in entries.flatten() {
                let bin = entry.path().join("bin");
                if bin.is_dir() {
                    extra_dirs.push(bin.to_string_lossy().to_string());
                }
            }
        }
    }

    if extra_dirs.is_empty() {
        current_path
    } else {
        extra_dirs.push(current_path);
        extra_dirs.join(":")
    }
}

/// Check if the daemon is already listening on port 4488.
fn daemon_is_running() -> bool {
    TcpStream::connect_timeout(&"127.0.0.1:4488".parse().unwrap(), Duration::from_millis(200))
        .is_ok()
}

/// Spawn `mix phx.server` in the daemon directory.
fn start_daemon() -> Option<Child> {
    if daemon_is_running() {
        log::info!("Daemon already running on :4488, skipping spawn");
        return None;
    }

    let dir = daemon_dir();
    if !dir.join("mix.exs").exists() {
        log::warn!("Daemon directory not found at {}, skipping", dir.display());
        return None;
    }

    let path = build_path();
    log::info!("Starting daemon in {}", dir.display());

    match Command::new("mix")
        .arg("phx.server")
        .current_dir(&dir)
        .env("PATH", &path)
        .env("MIX_ENV", "dev")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(child) => {
            log::info!("Daemon spawned (pid {})", child.id());
            Some(child)
        }
        Err(e) => {
            log::error!("Failed to spawn daemon: {e}");
            None
        }
    }
}

/// Block until daemon responds on :4488 or timeout (15s).
fn wait_for_daemon() {
    for i in 0..30 {
        if daemon_is_running() {
            log::info!("Daemon ready after ~{}ms", i * 500);
            return;
        }
        thread::sleep(Duration::from_millis(500));
    }
    log::warn!("Daemon did not become ready within 15s — frontend will retry");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let daemon_process: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .setup({
            let daemon_process = daemon_process.clone();
            move |app| {
                if cfg!(debug_assertions) {
                    app.handle().plugin(
                        tauri_plugin_log::Builder::default()
                            .level(log::LevelFilter::Info)
                            .build(),
                    )?;
                }

                // Start the Phoenix daemon
                let child = start_daemon();
                if child.is_some() {
                    wait_for_daemon();
                }
                *daemon_process.lock().unwrap() = child;

                // Build tray menu
                let show = MenuItemBuilder::with_id("show", "Show Launchpad").build(app)?;
                let quit = MenuItemBuilder::with_id("quit", "Quit EMA").build(app)?;
                let menu = MenuBuilder::new(app).items(&[&show, &quit]).build()?;

                // Create tray icon
                TrayIconBuilder::new()
                    .tooltip("EMA")
                    .menu(&menu)
                    .on_menu_event(move |app, event| match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("launchpad") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } => {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("launchpad") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    })
                    .build(app)?;

                Ok(())
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(move |_app, event| {
        if let RunEvent::Exit = event {
            let mut guard = daemon_process.lock().unwrap();
            if let Some(ref mut child) = *guard {
                log::info!("Shutting down daemon (pid {})", child.id());
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    });
}
