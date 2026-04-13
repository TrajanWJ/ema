use crate::origin_check::is_allowed_origin;
use crate::protocol::{ClientMessage, ServerMessage, PROTOCOL_VERSION};
use crate::window_mgr::WindowManager;
use futures_util::{SinkExt, StreamExt};
use log::{error, info, warn};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::handshake::server::{Request, Response};
use tokio_tungstenite::tungstenite::Message;

/// Port range the companion tries to bind to.
const PORT_RANGE: std::ops::RangeInclusive<u16> = 27182..=27189;

pub type SharedWindowManager = Arc<Mutex<WindowManager>>;

/// Bind to the first available port in the range.
async fn bind_listener() -> Result<(TcpListener, u16), String> {
    for port in PORT_RANGE {
        match TcpListener::bind(format!("127.0.0.1:{port}")).await {
            Ok(listener) => {
                info!("WebSocket server bound to port {port}");
                return Ok((listener, port));
            }
            Err(e) => {
                warn!("Port {port} unavailable: {e}");
            }
        }
    }
    Err("All ports 27182-27189 are in use".into())
}

/// Start the WebSocket server. Runs until the app exits.
/// Takes a broadcast sender for reattach events from Tauri IPC commands.
pub async fn run_server(
    wm: SharedWindowManager,
    reattach_tx: crate::commands::ReattachSender,
) -> Result<u16, String> {
    let (listener, port) = bind_listener().await?;

    tokio::spawn(async move {
        while let Ok((stream, addr)) = listener.accept().await {
            info!("New connection from {addr}");
            let wm = wm.clone();
            let reattach_rx = reattach_tx.subscribe();
            tokio::spawn(handle_connection(stream, wm, reattach_rx));
        }
    });

    Ok(port)
}

async fn handle_connection(
    stream: tokio::net::TcpStream,
    wm: SharedWindowManager,
    mut reattach_rx: tokio::sync::broadcast::Receiver<
        crate::commands::ReattachEvent,
    >,
) {
    // Origin check during WebSocket upgrade.
    // Use AtomicBool because the callback is FnOnce but we need to
    // read the result after the handshake completes.
    let allowed = Arc::new(AtomicBool::new(false));
    let allowed_inner = allowed.clone();

    #[allow(clippy::result_large_err)]
    let callback =
        |req: &Request, resp: Response| -> Result<Response, _> {
            if let Some(origin) = req.headers().get("origin") {
                if let Ok(origin_str) = origin.to_str() {
                    if is_allowed_origin(origin_str) {
                        allowed_inner.store(true, Ordering::Release);
                    }
                }
            }
            // Allow connections with no Origin header
            // (e.g., from Tauri webviews, CLI tools)
            if req.headers().get("origin").is_none() {
                allowed_inner.store(true, Ordering::Release);
            }
            Ok(resp)
        };

    let ws_stream =
        match tokio_tungstenite::accept_hdr_async(stream, callback).await {
            Ok(ws) => ws,
            Err(e) => {
                error!("WebSocket handshake failed: {e}");
                return;
            }
        };

    if !allowed.load(Ordering::Acquire) {
        warn!("Rejected connection: origin not in allowlist");
        return;
    }

    let (mut tx, mut rx) = ws_stream.split();

    // Send hello
    {
        let mgr = wm.lock().await;
        let hello = ServerMessage::Hello {
            version: PROTOCOL_VERSION.to_string(),
            windows: mgr.list_windows(),
        };
        if let Ok(json) = serde_json::to_string(&hello) {
            let _ = tx.send(Message::Text(json.into())).await;
        }
    }

    // Message loop with keepalive timeout and reattach event forwarding.
    let timeout_duration = tokio::time::Duration::from_secs(45);
    loop {
        tokio::select! {
            // Branch 1: WebSocket message from browser
            msg = tokio::time::timeout(timeout_duration, rx.next()) => {
                let msg = match msg {
                    Ok(Some(msg)) => msg,
                    Ok(None) => break,
                    Err(_) => {
                        warn!("Client timed out (no ping for 45s)");
                        break;
                    }
                };

                let text = match msg {
                    Ok(Message::Text(t)) => t.to_string(),
                    Ok(Message::Close(_)) => break,
                    Ok(Message::Ping(d)) => {
                        let _ = tx.send(Message::Pong(d)).await;
                        continue;
                    }
                    Ok(_) => continue,
                    Err(e) => {
                        error!("WebSocket error: {e}");
                        break;
                    }
                };

                let client_msg: ClientMessage =
                    match serde_json::from_str(&text) {
                        Ok(m) => m,
                        Err(e) => {
                            warn!("Invalid message: {e}");
                            continue;
                        }
                    };

                let response = process_message(client_msg, &wm).await;
                if let Some(resp) = response {
                    if let Ok(json) = serde_json::to_string(&resp) {
                        let _ =
                            tx.send(Message::Text(json.into())).await;
                    }
                }
            }

            // Branch 2: Reattach event from Tauri IPC
            event = reattach_rx.recv() => {
                if let Ok(event) = event {
                    let msg = ServerMessage::WindowReattach {
                        window_id: event.window_id.clone(),
                        app_id: event.app_id,
                    };
                    if let Ok(json) = serde_json::to_string(&msg) {
                        let _ =
                            tx.send(Message::Text(json.into())).await;
                    }
                    // Spawn 3s timeout — close window if no ack
                    let wm_timeout = wm.clone();
                    let wid = event.window_id;
                    tokio::spawn(async move {
                        tokio::time::sleep(
                            tokio::time::Duration::from_secs(3),
                        )
                        .await;
                        let mut mgr = wm_timeout.lock().await;
                        mgr.close_window(&wid);
                    });
                }
            }
        }
    }

    info!("Connection closed");
}

async fn process_message(
    msg: ClientMessage,
    wm: &SharedWindowManager,
) -> Option<ServerMessage> {
    match msg {
        ClientMessage::OpenWindow {
            window_id,
            app_id,
            url,
            bounds,
            transparent,
        } => {
            let mut mgr = wm.lock().await;
            match mgr
                .open_window(&window_id, &app_id, &url, &bounds, transparent)
            {
                Ok(actual_bounds) => Some(ServerMessage::WindowOpened {
                    window_id,
                    bounds: actual_bounds,
                }),
                Err(error) => {
                    Some(ServerMessage::WindowError { window_id, error })
                }
            }
        }
        ClientMessage::CloseWindow { window_id } => {
            let mut mgr = wm.lock().await;
            mgr.close_window(&window_id);
            None
        }
        ClientMessage::MoveWindow { window_id, x, y } => {
            let mut mgr = wm.lock().await;
            mgr.move_window(&window_id, x, y);
            None
        }
        ClientMessage::ResizeWindow {
            window_id,
            width,
            height,
        } => {
            let mut mgr = wm.lock().await;
            mgr.resize_window(&window_id, width, height);
            None
        }
        ClientMessage::FocusWindow { window_id } => {
            let mut mgr = wm.lock().await;
            mgr.focus_window(&window_id);
            None
        }
        ClientMessage::ReattachAck { window_id } => {
            let mut mgr = wm.lock().await;
            mgr.close_window(&window_id);
            None
        }
        ClientMessage::Ping => {
            let mgr = wm.lock().await;
            Some(ServerMessage::Pong {
                window_count: mgr.window_count(),
            })
        }
    }
}
