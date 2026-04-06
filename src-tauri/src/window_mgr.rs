use crate::protocol::{Bounds, WindowInfo};
use log::{info, warn};
use std::collections::HashMap;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Allowed URL prefixes for webview windows.
const ALLOWED_URL_PREFIXES: &[&str] = &[
    "https://place.org/",
    "https://www.place.org/",
    "http://localhost:3000/",
    "http://localhost:3001/",
    "http://localhost:3002/",
    "http://localhost:3003/",
    "http://localhost:3004/",
    "http://localhost:3005/",
    "http://localhost:3006/",
    "http://localhost:3007/",
    "http://localhost:3008/",
    "http://localhost:3009/",
];

fn is_allowed_url(url: &str) -> bool {
    ALLOWED_URL_PREFIXES.iter().any(|prefix| url.starts_with(prefix))
}

/// Initialization script injected into every companion webview.
/// Provides a minimal IPC bridge for the reattach flow.
/// Uses __TAURI_INTERNALS__ directly since these are external URLs
/// without bundled @tauri-apps/api.
const INIT_SCRIPT: &str = r#"
(function() {
    window.__PLACE_COMPANION__ = true;

    // Reattach: use Tauri IPC (remote.urls ACL makes __TAURI_INTERNALS__ available)
    window.__PLACE_COMPANION_REATTACH__ = function(windowId, appId) {
        if (window.__TAURI_INTERNALS__) {
            window.__TAURI_INTERNALS__.invoke('reattach', {
                windowId: windowId,
                appId: appId,
            });
        }
    };

    // Drag: Tauri's built-in drag.js handles data-tauri-drag-region automatically.
    // The remote.urls ACL grants start_dragging permission to external URLs.
    // No custom drag code needed.
})();
"#;

#[derive(Debug)]
struct TrackedWindow {
    app_id: String,
    bounds: Bounds,
}

pub struct WindowManager {
    windows: HashMap<String, TrackedWindow>,
    app_handle: AppHandle,
}

impl WindowManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            windows: HashMap::new(),
            app_handle,
        }
    }

    /// Returns info about all currently tracked windows.
    pub fn list_windows(&self) -> Vec<WindowInfo> {
        self.windows
            .iter()
            .map(|(id, w)| WindowInfo {
                window_id: id.clone(),
                app_id: w.app_id.clone(),
                bounds: w.bounds.clone(),
            })
            .collect()
    }

    pub fn window_count(&self) -> usize {
        self.windows.len()
    }

    /// Open a new transparent webview window. Idempotent: if the window_id
    /// already exists, focuses it instead.
    pub fn open_window(
        &mut self,
        window_id: &str,
        app_id: &str,
        url: &str,
        bounds: &Bounds,
        transparent: bool,
    ) -> Result<Bounds, String> {
        // URL validation
        if !is_allowed_url(url) {
            return Err(format!("URL not in allowlist: {url}"));
        }

        // Idempotent: already exists → focus
        if self.windows.contains_key(window_id) {
            info!("Window {window_id} already exists, focusing");
            if let Some(w) = self.app_handle.get_webview_window(&tauri_label(window_id)) {
                let _ = w.set_focus();
            }
            return Ok(bounds.clone());
        }

        let label = tauri_label(window_id);
        let parsed_url: url::Url = url
            .parse()
            .map_err(|e| format!("Invalid URL: {e}"))?;

        // Detect if we can do transparency (Linux X11 without compositor → fallback)
        let use_transparency = transparent && can_use_transparency();

        let builder = WebviewWindowBuilder::new(
            &self.app_handle,
            &label,
            WebviewUrl::External(parsed_url),
        )
        .title("")
        .inner_size(bounds.width, bounds.height)
        .position(bounds.x, bounds.y)
        .decorations(false)
        .transparent(use_transparency)
        .shadow(false)
        .resizable(true)
        .initialization_script(INIT_SCRIPT);

        let win = builder.build().map_err(|e| format!("Failed to create window: {e}"))?;

        // macOS: force NSWindow transparency via Objective-C runtime.
        // Belt-and-suspenders fix — wry 0.54.2+ should handle this,
        // but production DMG builds had issues (Tauri #13415).
        // We manually set NSWindow.isOpaque=false + backgroundColor=clearColor
        // after window creation to ensure transparency survives bundling.
        // macOS: force NSWindow transparency via Objective-C runtime.
        // Belt-and-suspenders fix — wry 0.54.2+ should handle this,
        // but production DMG builds had issues (Tauri #13415).
        #[cfg(target_os = "macos")]
        if use_transparency {
            if let Ok(ns_window_ptr) = win.ns_window() {
                unsafe {
                    use objc2::msg_send;
                    use objc2::runtime::AnyObject;
                    let ns_win = ns_window_ptr as *mut AnyObject;
                    let _: () = msg_send![ns_win, setOpaque: false];
                    let clear_color: *mut AnyObject = msg_send![
                        objc2::class!(NSColor), clearColor
                    ];
                    let _: () = msg_send![ns_win, setBackgroundColor: clear_color];
                }
                info!("macOS: forced NSWindow transparency for {window_id}");
            }
        }

        let _ = win.show();

        let actual_bounds = bounds.clone();
        self.windows.insert(
            window_id.to_string(),
            TrackedWindow {
                app_id: app_id.to_string(),
                bounds: actual_bounds.clone(),
            },
        );

        info!("Opened window {window_id} (app: {app_id}, transparent: {use_transparency})");
        Ok(actual_bounds)
    }

    /// Close and remove a window. No-op if not found.
    pub fn close_window(&mut self, window_id: &str) {
        if self.windows.remove(window_id).is_some() {
            if let Some(w) = self.app_handle.get_webview_window(&tauri_label(window_id)) {
                let _ = w.destroy();
            }
            info!("Closed window {window_id}");
        }
    }

    /// Close all tracked windows.
    pub fn close_all(&mut self) {
        let ids: Vec<String> = self.windows.keys().cloned().collect();
        for id in ids {
            self.close_window(&id);
        }
    }

    pub fn move_window(&mut self, window_id: &str, x: f64, y: f64) {
        if let Some(tracked) = self.windows.get_mut(window_id) {
            tracked.bounds.x = x;
            tracked.bounds.y = y;
            if let Some(w) = self.app_handle.get_webview_window(&tauri_label(window_id)) {
                let _ = w.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, y)));
            }
        }
    }

    pub fn resize_window(&mut self, window_id: &str, width: f64, height: f64) {
        if let Some(tracked) = self.windows.get_mut(window_id) {
            tracked.bounds.width = width;
            tracked.bounds.height = height;
            if let Some(w) = self.app_handle.get_webview_window(&tauri_label(window_id)) {
                let _ = w.set_size(tauri::Size::Logical(tauri::LogicalSize::new(width, height)));
            }
        }
    }

    pub fn focus_window(&mut self, window_id: &str) {
        if let Some(w) = self.app_handle.get_webview_window(&tauri_label(window_id)) {
            let _ = w.set_focus();
        }
    }

    /// Remove a window from tracking (called when Tauri reports window destroyed).
    #[allow(dead_code)]
    pub fn on_window_destroyed(&mut self, label: &str) -> Option<(String, String)> {
        let window_id = label.strip_prefix("place_")?;
        let tracked = self.windows.remove(window_id)?;
        Some((window_id.to_string(), tracked.app_id))
    }
}

/// Convert a place.org windowId to a Tauri window label.
/// Tauri labels must be alphanumeric + underscores.
fn tauri_label(window_id: &str) -> String {
    format!("place_{}", window_id.replace('-', "_"))
}

/// Detect whether the current platform supports transparent windows.
fn can_use_transparency() -> bool {
    #[cfg(target_os = "linux")]
    {
        if std::env::var("XDG_SESSION_TYPE").ok().as_deref() == Some("x11")
            && std::env::var("WAYLAND_DISPLAY").is_err()
        {
            let has_compositor = std::process::Command::new("xprop")
                .args(["-root", "_NET_WM_CM_S0"])
                .output()
                .map(|o| !o.stdout.is_empty() && o.status.success())
                .unwrap_or(false);
            if !has_compositor {
                warn!("X11 without compositor detected — transparency disabled");
                return false;
            }
        }
        true
    }
    #[cfg(not(target_os = "linux"))]
    {
        true
    }
}
