use axum::{extract::State, Json};
use crate::db::{self, AppState};
use serde_json::{json, Value};

pub async fn get_event(State(state): State<AppState>) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(Some(config)) = db::event::get(&conn) {
        Json(json!(config))
    } else {
        Json(json!({}))
    }
}

pub async fn update_event(
    State(state): State<AppState>,
    Json(payload): Json<db::event::EventConfig>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(_) = db::event::upsert(&conn, &payload) {
        Json(json!({"status": "success"}))
    } else {
        Json(json!({"error": "Failed to update event config"}))
    }
}
