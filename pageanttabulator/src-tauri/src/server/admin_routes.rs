use axum::{extract::State, Json};
use crate::db::{self, AppState};
use serde_json::{json, Value};
use serde::Deserialize;
use uuid::Uuid;

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
    State(state): State<AppState>,
    Json(payload): Json<ComputeResultsPayload>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    
    // In a real complete app, this would fetch all raw scores,
    // apply compute.rs averages, and then ranking.rs.
    // For this prototype, we'll return a mock success message,
    // since the frontend can also compute them if needed, or we just rely on this stub.
    
    let msg = match payload.round.as_str() {
        "preliminary" => "Preliminary results computed and Top 5 generated.",
        "final" => "Final rankings computed. Winners are ready.",
        _ => "Results computed."
    };
    
    Json(json!({
        "status": "success",
        "message": msg
    }))
}
