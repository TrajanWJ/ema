use tauri::{command, State};
use tokio::sync::broadcast;

/// Channel for reattach events from webview IPC → WebSocket server.
pub type ReattachSender = broadcast::Sender<ReattachEvent>;

#[derive(Debug, Clone)]
pub struct ReattachEvent {
    pub window_id: String,
    pub app_id: String,
}

/// Called from the webview (PopoutTitleBar) when user clicks "Return to desktop".
/// Tauri deserializes camelCase JS args into snake_case Rust params automatically.
#[command]
pub async fn reattach(
    window_id: String,
    app_id: String,
    sender: State<'_, ReattachSender>,
) -> Result<(), String> {
    log::info!("Reattach requested: windowId={window_id}, appId={app_id}");
    let _ = sender.send(ReattachEvent {
        window_id,
        app_id,
    });
    Ok(())
}
