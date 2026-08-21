use axum::{extract::State, Json};
use crate::db::{self, AppState};
use serde_json::{json, Value};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct VerifyPinPayload {
    pub pin: String,
}

pub async fn verify_pin(
    State(state): State<AppState>,
    Json(payload): Json<VerifyPinPayload>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(Some(config)) = db::event::get(&conn) {
        if config.admin_pin == payload.pin {
            return Json(json!({"valid": true}));
        }
    }
    Json(json!({"valid": false}))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputeResultsPayload {
    pub round: String,
}

pub async fn compute_results(
    State(_state): State<AppState>,
    Json(payload): Json<ComputeResultsPayload>,
) -> Json<Value> {
    // Stub. In reality, we'd trigger the rust scoring engine to compute preliminary/final.
    Json(json!({"status": "success", "message": format!("Computed results for round: {}", payload.round)}))
}
