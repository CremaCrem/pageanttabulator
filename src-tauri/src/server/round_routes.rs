use crate::db::{self, AppState};
use axum::{extract::State, Json};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};

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

    // Check if any round is already open
    if let Ok(rounds) = db::rounds::get_all(&conn) {
        if rounds.iter().any(|r| r.status == "open") {
            return Json(json!({"error": "Another segment is currently open"}));
        }
    }

    if payload.segment_id == "tie_breaking_qa" {
        if let Ok(candidates) = db::candidates::get_all(&conn) {
            let any_in_tiebreak = candidates.iter().any(|c| c.is_in_tiebreak);
            if !any_in_tiebreak {
                return Json(json!({
                    "error": "No finalists are flagged for a tie-break. Compute final results first. If a finals tie exists, candidates will be auto-flagged.",
                    "code": "NO_TIEBREAK_CANDIDATES"
                }));
            }
        }
    }

    let r = db::rounds::RoundState {
        segment_id: payload.segment_id.clone(),
        status: "open".to_string(),
        opened_at: Some(Utc::now().to_rfc3339()),
        locked_at: None,
    };

    if db::rounds::upsert(&conn, &r).is_ok() {
        // Auto-sync child segments
        let mut child_segment = None;
        if payload.segment_id == "school_uniform" {
            child_segment = Some("best_advocacy");
        } else if payload.segment_id == "modern_barong" {
            child_segment = Some("best_in_ramp");
        }

        if let Some(child_id) = child_segment {
            let child_r = db::rounds::RoundState {
                segment_id: child_id.to_string(),
                status: "open".to_string(),
                opened_at: Some(Utc::now().to_rfc3339()),
                locked_at: None,
            };
            let _ = db::rounds::upsert(&conn, &child_r);
        }

        let _ = state.ws_sender.send(json!({
            "type": "SEGMENT_OPENED",
            "segmentId": payload.segment_id,
            "segmentLabel": payload.segment_id
        }));

        let _ = crate::db::logs::insert(
            &conn,
            &crate::db::logs::SystemLog {
                id: uuid::Uuid::new_v4().to_string(),
                level: "info".to_string(),
                source: "admin".to_string(),
                message: format!("Admin opened segment: {}", payload.segment_id),
                details: None,
                created_at: Utc::now().to_rfc3339(),
            },
        );

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
        segment_id: payload.segment_id.clone(),
        status: "locked".to_string(),
        opened_at: None, // usually we preserve opened_at, this is simplified for stub
        locked_at: Some(Utc::now().to_rfc3339()),
    };

    if db::rounds::upsert(&conn, &r).is_ok() {
        // Auto-sync child segments
        let mut child_segment = None;
        if payload.segment_id == "school_uniform" {
            child_segment = Some("best_advocacy");
        } else if payload.segment_id == "modern_barong" {
            child_segment = Some("best_in_ramp");
        }

        if let Some(child_id) = child_segment {
            let child_r = db::rounds::RoundState {
                segment_id: child_id.to_string(),
                status: "locked".to_string(),
                opened_at: None,
                locked_at: Some(Utc::now().to_rfc3339()),
            };
            let _ = db::rounds::upsert(&conn, &child_r);
        }

        let _ = state.ws_sender.send(json!({
            "type": "SEGMENT_LOCKED",
            "segmentId": payload.segment_id
        }));

        let _ = crate::db::logs::insert(
            &conn,
            &crate::db::logs::SystemLog {
                id: uuid::Uuid::new_v4().to_string(),
                level: "info".to_string(),
                source: "admin".to_string(),
                message: format!("Admin locked segment: {}", payload.segment_id),
                details: None,
                created_at: Utc::now().to_rfc3339(),
            },
        );

        Json(json!({"status": "success"}))
    } else {
        Json(json!({"error": "Failed to lock round"}))
    }
}
