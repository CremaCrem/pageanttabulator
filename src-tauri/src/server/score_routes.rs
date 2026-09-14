use crate::db::{self, AppState};
use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

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

    // Prevent judge from overwriting their own submitted score
    if let Ok(scores) = db::scores::get_by_judge(&conn, &payload.judge_id) {
        if scores.iter().any(|s| s.segment_id == payload.segment_id && s.candidate_id == payload.candidate_id) {
            return Json(json!({
                "error": "Score already submitted for this candidate in this segment. Editing requires admin unlock."
            }));
        }
    }

    // Convert criteria to JSON string for storage
    let criteria_json = serde_json::to_string(&payload.criteria_entries).unwrap_or_default();

    let computed_score = crate::scoring::compute::compute_segment_score(
        &payload.segment_id,
        &payload.criteria_entries,
    );

    let score = db::scores::Score {
        id: Uuid::new_v4().to_string(),
        judge_id: payload.judge_id,
        candidate_id: payload.candidate_id,
        segment_id: payload.segment_id,
        criteria_json,
        computed_score,
        submitted_at: Utc::now().to_rfc3339(),
    };

    if db::scores::insert(&conn, &score).is_ok() {
        // Log individual submission
        let _ = crate::db::logs::insert(
            &conn,
            &crate::db::logs::SystemLog {
                id: Uuid::new_v4().to_string(),
                level: "info".to_string(),
                source: "judge".to_string(),
                message: format!("Judge {} submitted score for Candidate {}", score.judge_id, score.candidate_id),
                details: Some(format!("Segment: {}, Score: {}", score.segment_id, score.computed_score)),
                created_at: Utc::now().to_rfc3339(),
            },
        );

        // Check if finished scoring segment
        let mut expected_count = 0;
        if let Ok(candidates) = db::candidates::get_all(&conn) {
            let results = db::results::get_overall_results(&conn).unwrap_or_default();
            expected_count = candidates.iter().filter(|c| {
                if !c.is_eligible { return false; }
                if score.segment_id == "tie_breaking_qa" { return c.is_in_tiebreak; }
                if score.segment_id == "final_qa" {
                    return results.iter().any(|r| r.candidate_id == c.id && r.preliminary_status == "advancing");
                }
                true
            }).count();
        }

        let mut submitted_count = 0;
        if let Ok(scores) = db::scores::get_by_judge(&conn, &score.judge_id) {
            submitted_count = scores.iter().filter(|s| s.segment_id == score.segment_id).count();
        }

        if expected_count > 0 && submitted_count == expected_count {
            let _ = crate::db::logs::insert(
                &conn,
                &crate::db::logs::SystemLog {
                    id: Uuid::new_v4().to_string(),
                    level: "info".to_string(),
                    source: "judge".to_string(),
                    message: format!("Judge {} finished scoring all candidates in segment", score.judge_id),
                    details: Some(format!("Segment: {}", score.segment_id)),
                    created_at: Utc::now().to_rfc3339(),
                },
            );
        }

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
