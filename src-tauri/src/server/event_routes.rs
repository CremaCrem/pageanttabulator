use axum::{extract::State, Json};
use crate::db::{self, AppState};
use serde_json::{json, Value};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEventPayload {
    pub name: String,
    pub subtitle: Option<String>,
    pub event_date: Option<String>,
    pub venue: Option<String>,
    pub judge_count: Option<i64>,
    pub admin_pin: Option<String>,
}

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
    Json(payload): Json<UpdateEventPayload>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    
    // Check if event already exists to preserve pin and created_at if not provided
    let existing = db::event::get(&conn).ok().flatten();
    let now = chrono::Utc::now().to_rfc3339();
    
    let config = db::event::EventConfig {
        id: 1,
        name: payload.name,
        subtitle: payload.subtitle,
        event_date: payload.event_date,
        venue: payload.venue,
        judge_count: payload.judge_count.unwrap_or(5),
        admin_pin: payload.admin_pin.or_else(|| existing.map(|e| e.admin_pin)).unwrap_or_else(|| "1234".to_string()),
        created_at: now,
    };

    if let Ok(_) = db::event::upsert(&conn, &config) {
        Json(json!(config))
    } else {
        Json(json!({"error": "Failed to update event config"}))
    }
}
