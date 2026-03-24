use serde::Deserialize;
use tauri::{command, Manager, State, WebviewWindow};
use tokio::sync::broadcast;

/// Channel for reattach events from webview IPC → WebSocket server.
pub type ReattachSender = broadcast::Sender<ReattachEvent>;

#[derive(Debug, Clone)]
pub struct ReattachEvent {
    pub window_id: String,
    pub app_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReattachArgs {
    pub window_id: String,
    pub app_id: String,
}

/// Called from the webview (PopoutTitleBar) when user clicks "Return to desktop".
/// Sends the event over a broadcast channel. The WS server picks it up,
/// forwards to the browser, and waits for reattach-ack (or 3s timeout)
/// before closing the window.
#[command]
pub async fn reattach(
    args: ReattachArgs,
    sender: State<'_, ReattachSender>,
) -> Result<(), String> {
    log::info!(
        "Reattach requested: windowId={}, appId={}",
        args.window_id,
        args.app_id
    );
    let _ = sender.send(ReattachEvent {
        window_id: args.window_id,
        app_id: args.app_id,
    });
    Ok(())
}

// ── Drag via set_position (Wayland-compatible) ──

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DragToArgs {
    pub x: f64,
    pub y: f64,
}

/// Move the calling webview window to absolute screen coordinates.
/// Called repeatedly during drag from the webview's mousemove handler.
#[command]
pub fn drag_to(window: WebviewWindow, args: DragToArgs) -> Result<(), String> {
    window
        .set_position(tauri::Position::Logical(tauri::LogicalPosition::new(
            args.x, args.y,
        )))
        .map_err(|e| e.to_string())
}
