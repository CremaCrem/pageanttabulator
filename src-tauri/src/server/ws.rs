use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State},
    response::Response,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use serde_json::Value;
use crate::db::AppState;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.ws_sender.subscribe();

    // Log connection
    if let Ok(conn) = state.db.lock() {
        let _ = crate::db::logs::insert(&conn, &crate::db::logs::SystemLog {
            id: uuid::Uuid::new_v4().to_string(),
            level: "info".to_string(),
            source: "ws".to_string(),
            message: "New WebSocket connection established".to_string(),
            details: None,
            created_at: chrono::Utc::now().to_rfc3339(),
        });
    }

    // Spawn a task to forward messages from the broadcast channel to this client
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if let Ok(text) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(text.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    let state_clone = state.clone();

    // Spawn a task to read messages from this client
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            if let Ok(msg) = serde_json::from_str::<Value>(&text) {
                // Here we handle incoming WS events, like IDENTIFY or PING.
                // Depending on the role, we might log them or update active sessions.
                if let Some(msg_type) = msg.get("type").and_then(|v| v.as_str()) {
                    if msg_type == "ERROR" {
                        if let Ok(conn) = state_clone.db.lock() {
                            let _ = crate::db::logs::insert(&conn, &crate::db::logs::SystemLog {
                                id: uuid::Uuid::new_v4().to_string(),
                                level: "error".to_string(),
                                source: "frontend".to_string(),
                                message: "Frontend client reported an error".to_string(),
                                details: Some(msg.to_string()),
                                created_at: chrono::Utc::now().to_rfc3339(),
                            });
                        }
                    }
                }
            }
        }
    });

    // If any of the tasks terminate, abort the other.
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    // Log disconnection
    if let Ok(conn) = state.db.lock() {
        let _ = crate::db::logs::insert(&conn, &crate::db::logs::SystemLog {
            id: uuid::Uuid::new_v4().to_string(),
            level: "warn".to_string(),
            source: "ws".to_string(),
            message: "WebSocket connection closed".to_string(),
            details: None,
            created_at: chrono::Utc::now().to_rfc3339(),
        });
    }
}
