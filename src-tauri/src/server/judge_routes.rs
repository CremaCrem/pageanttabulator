use crate::db::{self, AppState};
use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

pub async fn get_judges(State(state): State<AppState>) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(judges) = db::judges::get_all(&conn) {
        Json(json!(judges))
    } else {
        Json(json!([]))
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaimSessionPayload {
    pub judge_id: String,
    pub device_token: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifySessionPayload {
    pub judge_id: String,
    pub session_token: String,
}

pub async fn claim_session(
    State(state): State<AppState>,
    Json(payload): Json<ClaimSessionPayload>,
) -> (axum::http::StatusCode, Json<Value>) {
    let conn = state.db.lock().unwrap();

    // Check existing judge
    if let Ok(Some(existing)) = db::judges::get_by_id(&conn, &payload.judge_id) {
        if existing.is_active {
            // If it's active but the client doesn't have the right token, reject
            if let Some(ref current_token) = existing.session_token {
                if payload.device_token.as_ref() != Some(current_token) {
                    return (
                        axum::http::StatusCode::CONFLICT,
                        Json(json!({"error": "Judge slot is already active on another device."})),
                    );
                }
            }
        }
    }

    let token = payload
        .device_token
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let now = chrono::Utc::now().to_rfc3339();

    let judge = db::judges::Judge {
        id: payload.judge_id.clone(),
        name: None,
        is_active: true,
        session_token: Some(token.clone()),
        last_seen: Some(now),
    };

    if let Ok(_) = db::judges::upsert(&conn, &judge) {
        (
            axum::http::StatusCode::OK,
            Json(json!({
                "status": "success",
                "sessionToken": token
            })),
        )
    } else {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to claim session"})),
        )
    }
}

pub async fn verify_session(
    State(state): State<AppState>,
    Json(payload): Json<VerifySessionPayload>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(Some(existing)) = db::judges::get_by_id(&conn, &payload.judge_id) {
        if existing.is_active && existing.session_token.as_ref() == Some(&payload.session_token) {
            return Json(json!({"valid": true}));
        }
    }
    Json(json!({"valid": false}))
}

pub async fn reset_session(
    State(state): State<AppState>,
    Path(judge_id): Path<String>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();

    // Also clear the session token so it's a completely clean slate
    if let Ok(_) = conn.execute(
        "UPDATE judges SET is_active = 0, session_token = NULL WHERE id = ?1",
        rusqlite::params![judge_id],
    ) {
        // Broadcast SESSION_REVOKED
        let _ = state.ws_sender.send(json!({
            "type": "SESSION_REVOKED",
            "judgeId": judge_id
        }));
        Json(json!({"status": "success"}))
    } else {
        Json(json!({"error": "Failed to reset session"}))
    }
}

pub async fn get_judge_status(State(state): State<AppState>) -> Json<Value> {
    let conn = state.db.lock().unwrap();

    if let Ok(judges) = db::judges::get_all(&conn) {
        let mut statuses = Vec::new();
        for mut j in judges {
            let count = db::scores::count_by_judge(&conn, &j.id).unwrap_or(0);
            // Hide the session token from the admin API for security
            j.session_token = None;

            let mut j_val = serde_json::to_value(&j).unwrap();
            if let Some(obj) = j_val.as_object_mut() {
                obj.insert("totalScoresSubmitted".to_string(), json!(count));
            }
            statuses.push(j_val);
        }
        Json(json!(statuses))
    } else {
        Json(json!([]))
    }
}
