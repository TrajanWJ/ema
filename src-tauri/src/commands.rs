use serde::Deserialize;
use tauri::{command, State};
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
