use axum::{extract::State, Json};
use crate::db::{self, AppState};
use serde_json::{json, Value};
use serde::Deserialize;
use chrono::Utc;

pub async fn get_rounds(State(state): State<AppState>) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(rounds) = db::rounds::get_all(&conn) {
        Json(json!(rounds))
    } else {
        Json(json!([]))
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoundActionPayload {
    pub segment_id: String,
}

pub async fn open_round(
    State(state): State<AppState>,
    Json(payload): Json<RoundActionPayload>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    let r = db::rounds::RoundState {
        segment_id: payload.segment_id,
        status: "open".to_string(),
        opened_at: Some(Utc::now().to_rfc3339()),
        locked_at: None,
    };
    
    if let Ok(_) = db::rounds::upsert(&conn, &r) {
        Json(json!({"status": "success"}))
    } else {
        Json(json!({"error": "Failed to open round"}))
    }
}

pub async fn lock_round(
    State(state): State<AppState>,
    Json(payload): Json<RoundActionPayload>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    let r = db::rounds::RoundState {
        segment_id: payload.segment_id,
        status: "locked".to_string(),
        opened_at: None, // usually we preserve opened_at, this is simplified for stub
        locked_at: Some(Utc::now().to_rfc3339()),
    };
    
    if let Ok(_) = db::rounds::upsert(&conn, &r) {
        Json(json!({"status": "success"}))
    } else {
        Json(json!({"error": "Failed to lock round"}))
    }
}
