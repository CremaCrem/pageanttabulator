use crate::db::{self, AppState};
use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEventPayload {
    pub name: String,
    pub subtitle: Option<String>,
    pub event_date: Option<String>,
    pub venue: Option<String>,
    pub judge_count: Option<i64>,
    pub admin_pin: Option<String>,
    pub head_tabulator: Option<String>,
    pub coordinator: Option<String>,
    pub auditor: Option<String>,
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
        admin_pin: payload
            .admin_pin
            .or_else(|| existing.as_ref().map(|e| e.admin_pin.clone()))
            .unwrap_or_else(|| "1234".to_string()),
        head_tabulator: payload.head_tabulator.or_else(|| existing.as_ref().and_then(|e| e.head_tabulator.clone())),
        coordinator: payload.coordinator.or_else(|| existing.as_ref().and_then(|e| e.coordinator.clone())),
        auditor: payload.auditor.or_else(|| existing.as_ref().and_then(|e| e.auditor.clone())),
        created_at: now,
    };

    if db::event::upsert(&conn, &config).is_ok() {
        let _ = crate::db::logs::insert(
            &conn,
            &crate::db::logs::SystemLog {
                id: uuid::Uuid::new_v4().to_string(),
                level: "info".to_string(),
                source: "admin".to_string(),
                message: "Admin updated event configuration".to_string(),
                details: None,
                created_at: chrono::Utc::now().to_rfc3339(),
            },
        );
        Json(json!(config))
    } else {
        Json(json!({"error": "Failed to update event config"}))
    }
}

pub async fn get_history(State(state): State<AppState>) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(events) = db::event::get_past_events(&conn) {
        Json(json!(events))
    } else {
        Json(json!([]))
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyPinPayload {
    pub pin: String,
}

pub async fn reset_event(
    State(state): State<AppState>,
    Json(payload): Json<VerifyPinPayload>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();

    // Verify PIN
    if let Ok(Some(config)) = db::event::get(&conn) {
        if config.admin_pin != payload.pin {
            return Json(json!({"error": "Invalid Admin PIN"}));
        }
    } else {
        return Json(json!({"error": "Failed to retrieve config"}));
    }

    if db::event::reset_active_event(&conn).is_ok() {
        // Broadcast reset event
        let _ = state.ws_sender.send(json!({ "type": "EVENT_RESET" }));

        let _ = crate::db::logs::insert(
            &conn,
            &crate::db::logs::SystemLog {
                id: uuid::Uuid::new_v4().to_string(),
                level: "warn".to_string(),
                source: "admin".to_string(),
                message: "Admin performed a hard reset of the active event".to_string(),
                details: None,
                created_at: chrono::Utc::now().to_rfc3339(),
            },
        );

        Json(json!({"success": true}))
    } else {
        Json(json!({"error": "Failed to reset event"}))
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveClosePayload {
    pub pin: String,
    pub winners_json: String,
}

pub async fn save_close_event(
    State(state): State<AppState>,
    Json(payload): Json<SaveClosePayload>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();

    // Verify PIN
    let config = match db::event::get(&conn) {
        Ok(Some(c)) => c,
        _ => return Json(json!({"error": "Failed to retrieve config"})),
    };
    if config.admin_pin != payload.pin {
        return Json(json!({"error": "Invalid Admin PIN"}));
    }

    let past_event = db::event::PastEvent {
        id: uuid::Uuid::new_v4().to_string(),
        name: config.name.clone(),
        subtitle: config.subtitle.clone(),
        event_date: config.event_date.clone(),
        winners_json: payload.winners_json,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    if db::event::save_past_event(&conn, &past_event).is_err() {
        return Json(json!({"error": "Failed to save past event archive"}));
    }

    if db::event::reset_active_event(&conn).is_err() {
        return Json(json!({"error": "Failed to reset active tables after saving"}));
    }

    let _ = crate::db::logs::insert(
        &conn,
        &crate::db::logs::SystemLog {
            id: uuid::Uuid::new_v4().to_string(),
            level: "warn".to_string(),
            source: "admin".to_string(),
            message: "Admin saved and closed the active event".to_string(),
            details: None,
            created_at: chrono::Utc::now().to_rfc3339(),
        },
    );

    let _ = state.ws_sender.send(json!({ "type": "EVENT_RESET" }));
    Json(json!({"success": true}))
}
