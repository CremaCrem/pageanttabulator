use axum::{extract::{State, Path}, Json};
use crate::db::{self, AppState};
use serde_json::{json, Value};
use serde::Deserialize;

pub async fn get_candidates(State(state): State<AppState>) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(candidates) = db::candidates::get_all(&conn) {
        Json(json!(candidates))
    } else {
        Json(json!([]))
    }
}

pub async fn add_candidate(
    State(state): State<AppState>,
    Json(payload): Json<db::candidates::Candidate>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(_) = db::candidates::insert(&conn, &payload) {
        Json(json!({"status": "success"}))
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
