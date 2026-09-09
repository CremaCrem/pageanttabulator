use crate::db::{self, AppState};
use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

pub async fn get_candidates(State(state): State<AppState>) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(candidates) = db::candidates::get_all(&conn) {
        Json(json!(candidates))
    } else {
        Json(json!([]))
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddCandidatePayload {
    pub id: Option<String>,
    pub candidate_number: String,
    pub full_name: String,
    pub nickname: Option<String>,
    pub gender: String,
    pub department: String,
    pub photo_path: Option<String>,
    pub is_eligible: Option<bool>,
}

pub async fn add_candidate(
    State(state): State<AppState>,
    Json(payload): Json<AddCandidatePayload>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    let now = chrono::Utc::now().to_rfc3339();
    let candidate = db::candidates::Candidate {
        id: payload
            .id
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
        candidate_number: payload.candidate_number,
        full_name: payload.full_name,
        nickname: payload.nickname,
        gender: payload.gender,
        department: payload.department,
        photo_path: payload.photo_path,
        is_eligible: payload.is_eligible.unwrap_or(true),
        disqualification_note: None,
        created_at: now,
    };

    if let Ok(_) = db::candidates::insert(&conn, &candidate) {
        Json(json!(candidate))
    } else {
        Json(json!({"error": "Failed to add candidate"}))
    }
}

pub async fn update_candidate(
    State(state): State<AppState>,
    Path(_id): Path<String>,
    Json(payload): Json<db::candidates::Candidate>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(_) = db::candidates::update(&conn, &payload) {
        Json(json!({"status": "success"}))
    } else {
        Json(json!({"error": "Failed to update candidate"}))
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisqualifyPayload {
    pub note: Option<String>,
}

pub async fn disqualify_candidate(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<DisqualifyPayload>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(_) = db::candidates::disqualify(&conn, &id, payload.note.as_deref()) {
        Json(json!({"status": "success"}))
    } else {
        Json(json!({"error": "Failed to disqualify candidate"}))
    }
}
