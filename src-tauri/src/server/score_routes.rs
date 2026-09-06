use axum::{extract::{State, Path}, Json};
use crate::db::{self, AppState};
use serde_json::{json, Value};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::Utc;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitScorePayload {
    pub judge_id: String,
    pub candidate_id: String,
    pub segment_id: String,
    pub criteria_entries: Vec<CriterionEntry>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CriterionEntry {
    pub criterion_id: String,
    pub score: u32,
}

pub async fn submit_score(
    State(state): State<AppState>,
    Json(payload): Json<SubmitScorePayload>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    
    // Convert criteria to JSON string for storage
    let criteria_json = serde_json::to_string(&payload.criteria_entries).unwrap_or_default();
    
    let computed_score = crate::scoring::compute::compute_segment_score(&payload.segment_id, &payload.criteria_entries);
    
    let score = db::scores::Score {
        id: Uuid::new_v4().to_string(),
        judge_id: payload.judge_id,
        candidate_id: payload.candidate_id,
        segment_id: payload.segment_id,
        criteria_json,
        computed_score,
        submitted_at: Utc::now().to_rfc3339(),
    };
    
    if let Ok(_) = db::scores::insert(&conn, &score) {
        Json(json!({
            "scoreId": score.id,
            "computedScore": score.computed_score,
            "submittedAt": score.submitted_at
        }))
    } else {
        Json(json!({"error": "Failed to submit score or score already exists"}))
    }
}

pub async fn get_score_summary(State(_state): State<AppState>) -> Json<Value> {
    // Stub. In reality we aggregate scores per candidate per segment here.
    Json(json!([]))
}

pub async fn get_scores_by_judge(
    State(state): State<AppState>,
    Path(judge_id): Path<String>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(scores) = db::scores::get_by_judge(&conn, &judge_id) {
        Json(json!(scores))
    } else {
        Json(json!([]))
    }
}

pub async fn get_all_scores(State(state): State<AppState>) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(scores) = db::scores::get_all(&conn) {
        Json(json!(scores))
    } else {
        Json(json!([]))
    }
}
