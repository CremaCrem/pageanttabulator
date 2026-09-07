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

    let judge_id_ref = std::sync::Arc::new(std::sync::Mutex::new(None::<String>));
    let judge_id_clone = judge_id_ref.clone();

    // Spawn a task to read messages from this client
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            if let Ok(msg) = serde_json::from_str::<Value>(&text) {
                // Here we handle incoming WS events, like IDENTIFY or PING.
                if let Some(msg_type) = msg.get("type").and_then(|v| v.as_str()) {
                    if msg_type == "IDENTIFY" {
                        if let Some(j_id) = msg.get("judgeId").and_then(|v| v.as_str()) {
                            *judge_id_clone.lock().unwrap() = Some(j_id.to_string());
                            if let Ok(conn) = state_clone.db.lock() {
                                let now = chrono::Utc::now().to_rfc3339();
                                // Just update last_seen, preserve is_active
                                let _ = conn.execute(
                                    "UPDATE judges SET last_seen = ?1 WHERE id = ?2",
                                    rusqlite::params![now, j_id],
                                );
                            }
                        }
                    } else if msg_type == "PING" {
                        if let Some(j_id) = judge_id_clone.lock().unwrap().as_ref() {
                            if let Ok(conn) = state_clone.db.lock() {
                                let now = chrono::Utc::now().to_rfc3339();
                                let _ = conn.execute(
                                    "UPDATE judges SET last_seen = ?1 WHERE id = ?2",
                                    rusqlite::params![now, j_id],
                                );
                            }
                        }
                    } else if msg_type == "ERROR" {
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

    // Log disconnection and set last_seen to past
    if let Ok(conn) = state.db.lock() {
        if let Some(j_id) = judge_id_ref.lock().unwrap().as_ref() {
            let past = "1970-01-01T00:00:00+00:00";
            let _ = conn.execute(
                "UPDATE judges SET last_seen = ?1 WHERE id = ?2",
                rusqlite::params![past, j_id],
            );
        }
        
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
