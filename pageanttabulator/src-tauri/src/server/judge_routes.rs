use axum::{extract::{State, Path}, Json};
use crate::db::{self, AppState};
use serde_json::{json, Value};
use serde::Deserialize;

pub async fn get_judges(State(state): State<AppState>) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(judges) = db::judges::get_all(&conn) {
        Json(json!(judges))
    } else {
        Json(json!([]))
    }
}

#[derive(Deserialize)]
pub struct ClaimSessionPayload {
    pub judge_id: String,
}

pub async fn claim_session(
    State(state): State<AppState>,
    Json(payload): Json<ClaimSessionPayload>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    // In a real implementation we would check if it's already active,
    // but for now we just upsert it.
    let now = chrono::Utc::now().to_rfc3339();
    let judge = db::judges::Judge {
        id: payload.judge_id.clone(),
        name: None,
        is_active: true,
        last_seen: Some(now),
    };
    
    if let Ok(_) = db::judges::upsert(&conn, &judge) {
        Json(json!({"status": "success"}))
    } else {
        Json(json!({"error": "Failed to claim session"}))
    }
}

pub async fn reset_session(
    State(state): State<AppState>,
    Path(judge_id): Path<String>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(_) = db::judges::set_active(&conn, &judge_id, false, None) {
        Json(json!({"status": "success"}))
    } else {
        Json(json!({"error": "Failed to reset session"}))
    }
}

pub async fn get_judge_status(State(_state): State<AppState>) -> Json<Value> {
    // Stub for now. Would join judges and scores to see progress.
    Json(json!([]))
}
