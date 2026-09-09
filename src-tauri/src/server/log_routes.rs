use crate::db::{self, AppState};
use axum::{extract::State, Json};
use serde_json::{json, Value};

pub async fn get_logs(State(state): State<AppState>) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(logs) = db::logs::get_all(&conn) {
        Json(json!(logs))
    } else {
        Json(json!([]))
    }
}

pub async fn clear_logs(State(state): State<AppState>) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(_) = db::logs::clear_all(&conn) {
        Json(json!({"success": true}))
    } else {
        Json(json!({"error": "Failed to clear logs"}))
    }
}
