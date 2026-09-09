use crate::db::{self, AppState};
use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
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
    let now = chrono::Utc::now().to_rfc3339();

    match payload.round.as_str() {
        "preliminary" => {
            let candidates = db::candidates::get_all(&conn).unwrap_or_default();
            let scores = db::scores::get_all(&conn).unwrap_or_default();

            let prelim_segments = vec![
                "production_number",
                "school_uniform",
                "professional_attire",
                "modern_barong",
                "preliminary_qa",
            ];

            let mut candidate_prelim_ranks: HashMap<String, f64> = HashMap::new();

            for segment in &prelim_segments {
                let mut segment_scores_by_judge: HashMap<String, Vec<crate::scoring::ranking::JudgeRawScore>> = HashMap::new();
                
                for score in &scores {
                    if score.segment_id == *segment {
                        segment_scores_by_judge
                            .entry(score.judge_id.clone())
                            .or_default()
                            .push(crate::scoring::ranking::JudgeRawScore {
                                candidate_id: score.candidate_id.clone(),
                                raw_score: score.computed_score,
                            });
                    }
                }
                
                let mut judge_ranks = Vec::new();
                for (_, judge_raw_scores) in segment_scores_by_judge {
                    let ranks = crate::scoring::ranking::rank_segment_scores(judge_raw_scores);
                    judge_ranks.push(ranks);
                }
                
                let consolidated = crate::scoring::ranking::consolidate_segment_ranks(judge_ranks);
                
                // Keep track of best male/female for special awards (excluding QA)
                let mut best_male: Option<(String, u32)> = None;
                let mut best_female: Option<(String, u32)> = None;

                for res in consolidated {
                    *candidate_prelim_ranks.entry(res.candidate_id.clone()).or_insert(0.0) += (res.final_rank as f64) * 0.20;

                    if *segment != "preliminary_qa" {
                        if let Some(c) = candidates.iter().find(|c| c.id == res.candidate_id) {
                            if c.gender == "male" {
                                if best_male.is_none() || res.final_rank < best_male.as_ref().unwrap().1 {
                                    best_male = Some((c.id.clone(), res.final_rank));
                                }
                            } else if c.gender == "female" {
                                if best_female.is_none() || res.final_rank < best_female.as_ref().unwrap().1 {
                                    best_female = Some((c.id.clone(), res.final_rank));
                                }
                            }
                        }
                    }
                }

                if *segment != "preliminary_qa" {
                    let award = db::special_awards::SpecialAward {
                        award_id: segment.to_string(),
                        winner_male_id: best_male.map(|x| x.0),
                        winner_female_id: best_female.map(|x| x.0),
                        is_auto_computed: true,
                        notes: None,
                        assigned_at: Some(now.clone()),
                    };
                    let _ = db::special_awards::insert_or_update(&conn, &award);
                }
            }

            let mut male_results: Vec<db::results::CandidateResult> = Vec::new();
            let mut female_results: Vec<db::results::CandidateResult> = Vec::new();

            for c in &candidates {
                let prelim_score = candidate_prelim_ranks.get(&c.id).copied().unwrap_or(0.0);

                let res = db::results::CandidateResult {
                    candidate_id: c.id.clone(),
                    segment_id: None, // Overall result
                    preliminary_score: Some(prelim_score),
                    final_qa_score: None,
                    final_score: None,
                    rank: None,
                    is_top3: false,
                    computed_at: now.clone(),
                };

                if c.gender == "male" {
                    male_results.push(res);
                } else if c.gender == "female" {
                    female_results.push(res);
                }
            }

            // Sort and rank preliminary (ascending for Borda count)
            crate::scoring::ranking::rank_candidates(&mut male_results);
            crate::scoring::ranking::select_top3(&mut male_results);

            crate::scoring::ranking::rank_candidates(&mut female_results);
            crate::scoring::ranking::select_top3(&mut female_results);

            // Save to DB
            for r in male_results.iter().chain(female_results.iter()) {
                let _ = db::results::insert(&conn, r);
            }

            Json(json!({
                "status": "success",
                "message": "Preliminary composite ranks computed. Top 3 generated."
            }))
        }
        "final" => {
            let candidates = db::candidates::get_all(&conn).unwrap_or_default();
            let mut results = db::results::get_overall_results(&conn).unwrap_or_default();
            let scores = db::scores::get_all(&conn).unwrap_or_default();

            let mut score_map: HashMap<(String, String), Vec<f64>> = HashMap::new();
            for score in scores {
                score_map
                    .entry((score.candidate_id, score.segment_id))
                    .or_insert_with(Vec::new)
                    .push(score.computed_score);
            }

            let mut male_results: Vec<db::results::CandidateResult> = Vec::new();
            let mut female_results: Vec<db::results::CandidateResult> = Vec::new();

            for res in results.iter_mut() {
                if !res.is_top3 {
                    continue;
                }

                // Get gender
                let gender = candidates
                    .iter()
                    .find(|c| c.id == res.candidate_id)
                    .map(|c| c.gender.as_str())
                    .unwrap_or("");

                // Final QA avg
                let mut final_qa_avg = 0.0;
                if let Some(list) =
                    score_map.get(&(res.candidate_id.clone(), "final_qa".to_string()))
                {
                    if !list.is_empty() {
                        let sum: f64 = list.iter().sum();
                        final_qa_avg = sum / list.len() as f64;
                    }
                }

                res.final_qa_score = Some(final_qa_avg);

                let prelim = res.preliminary_score.unwrap_or(0.0);
                res.final_score = Some(crate::scoring::compute::compute_final_score(
                    prelim,
                    final_qa_avg,
                ));
                res.computed_at = now.clone();

                if gender == "male" {
                    male_results.push(res.clone());
                } else if gender == "female" {
                    female_results.push(res.clone());
                }
            }

            // Rank final winners
            crate::scoring::ranking::rank_candidates(&mut male_results);
            crate::scoring::ranking::rank_candidates(&mut female_results);

            for r in male_results.iter().chain(female_results.iter()) {
                let _ = db::results::insert(&conn, r);
            }

            Json(json!({
                "status": "success",
                "message": "Final rankings computed. Winners are ready."
            }))
        }
        "minor_awards" => {
            let candidates = db::candidates::get_all(&conn).unwrap_or_default();
            let scores = db::scores::get_all(&conn).unwrap_or_default();

            // Group scores by (candidate_id, segment_id) -> Vec<f64>
            let mut score_map: HashMap<(String, String), Vec<f64>> = HashMap::new();
            for score in scores {
                score_map
                    .entry((score.candidate_id, score.segment_id))
                    .or_insert_with(Vec::new)
                    .push(score.computed_score);
            }

            let get_avg = |c_id: &str, s_id: &str| -> Option<f64> {
                if let Some(list) = score_map.get(&(c_id.to_string(), s_id.to_string())) {
                    if !list.is_empty() {
                        let sum: f64 = list.iter().sum();
                        return Some(sum / list.len() as f64);
                    }
                }
                None
            };

            let minor_segments = vec!["best_advocacy", "best_in_ramp"];

            for segment in minor_segments {
                let mut best_male: Option<(String, f64)> = None;
                let mut best_female: Option<(String, f64)> = None;

                for c in &candidates {
                    if let Some(avg) = get_avg(&c.id, segment) {
                        if c.gender == "male" {
                            if best_male.is_none() || avg > best_male.as_ref().unwrap().1 {
                                best_male = Some((c.id.clone(), avg));
                            }
                        } else if c.gender == "female" {
                            if best_female.is_none() || avg > best_female.as_ref().unwrap().1 {
                                best_female = Some((c.id.clone(), avg));
                            }
                        }
                    }
                }

                let award = db::special_awards::SpecialAward {
                    award_id: segment.to_string(),
                    winner_male_id: best_male.map(|x| x.0),
                    winner_female_id: best_female.map(|x| x.0),
                    is_auto_computed: true,
                    notes: None,
                    assigned_at: Some(now.clone()),
                };
                let _ = db::special_awards::insert_or_update(&conn, &award);
            }

            Json(json!({
                "status": "success",
                "message": "Minor awards computed."
            }))
        }
        _ => Json(json!({
            "status": "error",
            "message": "Unknown round type."
        })),
    }
}

pub async fn get_results(State(state): State<AppState>) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(results) = db::results::get_overall_results(&conn) {
        Json(json!(results))
    } else {
        Json(json!([]))
    }
}

pub async fn get_special_awards(State(state): State<AppState>) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    if let Ok(awards) = db::special_awards::get_all(&conn) {
        Json(json!(awards))
    } else {
        Json(json!([]))
    }
}
