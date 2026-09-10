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

    // One-time cleanup: purge duplicate overall-result rows caused by the NULL-uniqueness bug
    match db::results::cleanup_duplicate_overall_results(&conn) {
        Ok(deleted) => {
            if deleted > 0 {
                eprintln!("[cleanup] Removed {} duplicate overall-result rows", deleted);
            }
        }
        Err(e) => eprintln!("[cleanup] Failed to clean duplicate results: {}", e),
    }

    match payload.round.as_str() {
        "preliminary" => {
            let candidates = db::candidates::get_all(&conn).unwrap_or_default();
            let scores = db::scores::get_all(&conn).unwrap_or_default();

            // Build candidate gender map (reuse same approach as get_results_breakdown)
            let mut candidate_genders: HashMap<String, String> = HashMap::new();
            for c in &candidates {
                candidate_genders.insert(c.id.clone(), c.gender.clone());
            }

            let prelim_segments = vec![
                "production_number",
                "school_uniform",
                "professional_attire",
                "modern_barong",
                "preliminary_qa",
            ];

            // Track composite ranks per candidate (weighted sum of segment final_ranks)
            let mut candidate_prelim_ranks: HashMap<String, f64> = HashMap::new();

            for segment in &prelim_segments {
                // Group raw scores by judge
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
                
                // Gender-segregated ranking per judge (same logic as get_results_breakdown)
                let mut male_judge_ranks = Vec::new();
                let mut female_judge_ranks = Vec::new();
                
                for (_, judge_raw_scores) in segment_scores_by_judge {
                    let mut male_scores = Vec::new();
                    let mut female_scores = Vec::new();
                    
                    for score in judge_raw_scores {
                        if let Some(gender) = candidate_genders.get(&score.candidate_id) {
                            if gender.to_lowercase() == "male" {
                                male_scores.push(score);
                            } else if gender.to_lowercase() == "female" {
                                female_scores.push(score);
                            }
                        }
                    }
                    
                    if !male_scores.is_empty() {
                        male_judge_ranks.push(crate::scoring::ranking::rank_segment_scores(male_scores));
                    }
                    if !female_scores.is_empty() {
                        female_judge_ranks.push(crate::scoring::ranking::rank_segment_scores(female_scores));
                    }
                }
                
                let male_consolidated = crate::scoring::ranking::consolidate_segment_ranks(male_judge_ranks);
                let female_consolidated = crate::scoring::ranking::consolidate_segment_ranks(female_judge_ranks);

                for res in male_consolidated.into_iter().chain(female_consolidated.into_iter()) {
                    // Each segment contributes 20% to the preliminary composite
                    *candidate_prelim_ranks.entry(res.candidate_id.clone()).or_insert(0.0) += (res.final_rank as f64) * 0.20;
                }
            }

            let mut male_results: Vec<db::results::CandidateResult> = Vec::new();
            let mut female_results: Vec<db::results::CandidateResult> = Vec::new();

            for c in &candidates {
                let prelim_score = candidate_prelim_ranks.get(&c.id).copied().unwrap_or(0.0);

                let res = db::results::CandidateResult {
                    candidate_id: c.id.clone(),
                    segment_id: Some("".to_string()), // Empty string, not NULL — makes UNIQUE constraint work
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

            // Sort and rank preliminary (ascending for Borda count) — within each gender
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

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SegmentBreakdown {
    pub candidate_id: String,
    pub segment_id: String,
    pub rank_sum: u32,
    pub raw_score_sum: f64,
    pub final_rank: u32,
}

pub async fn get_results_breakdown(State(state): State<AppState>) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    let scores = db::scores::get_all(&conn).unwrap_or_default();
    let candidates = db::candidates::get_all(&conn).unwrap_or_default();
    
    let mut candidate_genders = std::collections::HashMap::new();
    for candidate in candidates {
        candidate_genders.insert(candidate.id, candidate.gender);
    }
    
    let segments = vec![
        "production_number",
        "school_uniform",
        "professional_attire",
        "modern_barong",
        "preliminary_qa",
        "final_qa",
        "tie_breaking_qa"
    ];
    
    let mut breakdown: Vec<SegmentBreakdown> = Vec::new();
    
    for segment in segments {
        let mut segment_scores_by_judge: std::collections::HashMap<String, Vec<crate::scoring::ranking::JudgeRawScore>> = std::collections::HashMap::new();
        
        for score in &scores {
            if score.segment_id == segment {
                segment_scores_by_judge
                    .entry(score.judge_id.clone())
                    .or_default()
                    .push(crate::scoring::ranking::JudgeRawScore {
                        candidate_id: score.candidate_id.clone(),
                        raw_score: score.computed_score,
                    });
            }
        }
        
        if segment_scores_by_judge.is_empty() {
            continue;
        }
        
        let mut male_judge_ranks = Vec::new();
        let mut female_judge_ranks = Vec::new();
        
        for (_, judge_raw_scores) in segment_scores_by_judge {
            let mut male_scores = Vec::new();
            let mut female_scores = Vec::new();
            
            for score in judge_raw_scores {
                if let Some(gender) = candidate_genders.get(&score.candidate_id) {
                    if gender.to_lowercase() == "male" {
                        male_scores.push(score);
                    } else if gender.to_lowercase() == "female" {
                        female_scores.push(score);
                    }
                }
            }
            
            if !male_scores.is_empty() {
                male_judge_ranks.push(crate::scoring::ranking::rank_segment_scores(male_scores));
            }
            if !female_scores.is_empty() {
                female_judge_ranks.push(crate::scoring::ranking::rank_segment_scores(female_scores));
            }
        }
        
        let male_consolidated = crate::scoring::ranking::consolidate_segment_ranks(male_judge_ranks);
        let female_consolidated = crate::scoring::ranking::consolidate_segment_ranks(female_judge_ranks);
        
        for res in male_consolidated.into_iter().chain(female_consolidated.into_iter()) {
            breakdown.push(SegmentBreakdown {
                candidate_id: res.candidate_id,
                segment_id: segment.to_string(),
                rank_sum: res.rank_sum,
                raw_score_sum: res.raw_score_sum,
                final_rank: res.final_rank,
            });
        }
    }
    
    Json(json!(breakdown))
}
