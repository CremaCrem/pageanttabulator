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
            let mut candidate_prelim_ranks: HashMap<String, Vec<f64>> = HashMap::new();

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

                for res in male_consolidated.into_iter().chain(female_consolidated) {
                    candidate_prelim_ranks.entry(res.candidate_id.clone()).or_default().push(res.final_rank as f64);
                }
            }

            let mut male_results: Vec<db::results::CandidateResult> = Vec::new();
            let mut female_results: Vec<db::results::CandidateResult> = Vec::new();

            for c in &candidates {
                let ranks = candidate_prelim_ranks.get(&c.id).cloned().unwrap_or_default();
                let prelim_score = crate::scoring::compute::compute_preliminary_score(&ranks);

                let res = db::results::CandidateResult {
                    candidate_id: c.id.clone(),
                    segment_id: Some("".to_string()), // Empty string, not NULL — makes UNIQUE constraint work
                    preliminary_score: Some(prelim_score),
                    preliminary_status: "pending".to_string(),
                    final_qa_score: None,
                    final_score: None,
                    rank: None,
                    computed_at: now.clone(),
                };

                if c.gender == "male" {
                    male_results.push(res);
                } else if c.gender == "female" {
                    female_results.push(res);
                }
            }

            let resolutions = db::stage_resolutions::get_by_stage(&conn, "preliminary_boundary").unwrap_or_default();
            let mut overrides = std::collections::HashMap::new();
            for r in resolutions {
                overrides.insert(r.candidate_id, r.resolution);
            }

            let apply_top3 = |results: &mut Vec<db::results::CandidateResult>| {
                crate::scoring::ranking::select_top3(results, &overrides);
            };

            // Sort and rank preliminary (ascending for Borda count) — within each gender
            crate::scoring::ranking::rank_candidates(&mut male_results);
            apply_top3(&mut male_results);

            crate::scoring::ranking::rank_candidates(&mut female_results);
            apply_top3(&mut female_results);

            // Save to DB
            for r in male_results.iter().chain(female_results.iter()) {
                let _ = db::results::insert(&conn, r);
            }

            let _ = crate::db::logs::insert(
                &conn,
                &crate::db::logs::SystemLog {
                    id: uuid::Uuid::new_v4().to_string(),
                    level: "info".to_string(),
                    source: "admin".to_string(),
                    message: "Admin computed Preliminary results".to_string(),
                    details: None,
                    created_at: chrono::Utc::now().to_rfc3339(),
                },
            );

            Json(json!({
                "status": "success",
                "message": "Preliminary results computed."
            }))
        }
        "final" => {
            let candidates = db::candidates::get_all(&conn).unwrap_or_default();
            let mut results = db::results::get_overall_results(&conn).unwrap_or_default();
            let scores = db::scores::get_all(&conn).unwrap_or_default();

            let mut male_results: Vec<db::results::CandidateResult> = Vec::new();
            let mut female_results: Vec<db::results::CandidateResult> = Vec::new();

            let rank_final_qa = |gender_top3_ids: &[String]| {
                let mut segment_scores_by_judge: HashMap<String, Vec<crate::scoring::ranking::JudgeRawScore>> = HashMap::new();
                for score in &scores {
                    if score.segment_id == "final_qa" && gender_top3_ids.contains(&score.candidate_id) {
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
                    if !judge_raw_scores.is_empty() {
                        judge_ranks.push(crate::scoring::ranking::rank_segment_scores(judge_raw_scores));
                    }
                }
                let consolidated = crate::scoring::ranking::consolidate_segment_ranks(judge_ranks);
                let mut ranks_map = HashMap::new();
                for res in consolidated {
                    ranks_map.insert(res.candidate_id, res.final_rank);
                }
                ranks_map
            };

            let male_top3_ids: Vec<String> = results.iter().filter(|r| r.preliminary_status == "advancing" && candidates.iter().find(|c| c.id == r.candidate_id).is_some_and(|c| c.gender == "male")).map(|r| r.candidate_id.clone()).collect();
            let female_top3_ids: Vec<String> = results.iter().filter(|r| r.preliminary_status == "advancing" && candidates.iter().find(|c| c.id == r.candidate_id).is_some_and(|c| c.gender == "female")).map(|r| r.candidate_id.clone()).collect();
            
            let mut final_qa_ranks: HashMap<String, u32> = HashMap::new();
            final_qa_ranks.extend(rank_final_qa(&male_top3_ids));
            final_qa_ranks.extend(rank_final_qa(&female_top3_ids));

            for res in results.iter_mut() {
                if res.preliminary_status != "advancing" {
                    continue;
                }

                // Get gender
                let gender = candidates
                    .iter()
                    .find(|c| c.id == res.candidate_id)
                    .map(|c| c.gender.as_str())
                    .unwrap_or("");

                let final_qa_rank_val = final_qa_ranks.get(&res.candidate_id).copied().unwrap_or(0);
                res.final_qa_score = Some(final_qa_rank_val as f64);

                let prelim_rank = res.rank.unwrap_or(0) as f64;
                res.final_score = Some(crate::scoring::compute::compute_final_score(
                    prelim_rank,
                    final_qa_rank_val as f64,
                ));
                res.computed_at = now.clone();

                if gender == "male" {
                    male_results.push(res.clone());
                } else if gender == "female" {
                    female_results.push(res.clone());
                }
            }

            // TIE-BREAK RESOLUTION & AUTO-FLAGGING
            let mut tiebreak_scores_exist = false;
            for score in &scores {
                if score.segment_id == "tie_breaking_qa" {
                    tiebreak_scores_exist = true;
                    break;
                }
            }

            let process_finals = |gender_results: &mut Vec<db::results::CandidateResult>| {
                // Build a per-candidate tiebreak Borda rank (among the tied subset only).
                // Key: candidate_id → their Borda rank within their tie group from the tiebreak Q&A.
                let mut tb_rank_map: HashMap<String, u32> = HashMap::new();

                if tiebreak_scores_exist {
                    // Find which candidates are tied in final_score (for this gender group)
                    let mut score_count: HashMap<String, usize> = HashMap::new();
                    for res in gender_results.iter() {
                        let score_str = format!("{:.4}", res.final_score.unwrap_or(0.0));
                        *score_count.entry(score_str).or_insert(0) += 1;
                    }

                    // Collect tied-candidate IDs grouped by their shared score bucket
                    let mut tie_groups: HashMap<String, Vec<String>> = HashMap::new();
                    for res in gender_results.iter() {
                        let score_str = format!("{:.4}", res.final_score.unwrap_or(0.0));
                        if score_count.get(&score_str).copied().unwrap_or(0) > 1 {
                            tie_groups.entry(score_str).or_default().push(res.candidate_id.clone());
                        }
                    }

                    // For each tie group, run Borda count on tiebreak Q&A scores
                    for group_ids in tie_groups.values() {
                        let mut segment_scores_by_judge: HashMap<String, Vec<crate::scoring::ranking::JudgeRawScore>> = HashMap::new();
                        for score in &scores {
                            if score.segment_id == "tie_breaking_qa" && group_ids.contains(&score.candidate_id) {
                                segment_scores_by_judge
                                    .entry(score.judge_id.clone())
                                    .or_default()
                                    .push(crate::scoring::ranking::JudgeRawScore {
                                        candidate_id: score.candidate_id.clone(),
                                        raw_score: score.computed_score,
                                    });
                            }
                        }

                        let judge_ranks: Vec<_> = segment_scores_by_judge
                            .into_values()
                            .filter(|v| !v.is_empty())
                            .map(crate::scoring::ranking::rank_segment_scores)
                            .collect();

                        if !judge_ranks.is_empty() {
                            let consolidated = crate::scoring::ranking::consolidate_segment_ranks(judge_ranks);
                            for r in consolidated {
                                tb_rank_map.insert(r.candidate_id, r.final_rank);
                            }
                        }
                        // If no judge ranks, tb_rank_map has no entries for these — they stay tied
                    }
                }

                // Determine who is still tied after tiebreak resolution:
                // — Tied in final_score AND either no tiebreak scores exist, OR tiebreak also ties them.
                let mut score_count: HashMap<String, usize> = HashMap::new();
                for res in gender_results.iter() {
                    let score_str = format!("{:.4}", res.final_score.unwrap_or(0.0));
                    *score_count.entry(score_str).or_insert(0) += 1;
                }
                let mut all_tied: std::collections::HashSet<String> = std::collections::HashSet::new();
                for res in gender_results.iter() {
                    let score_str = format!("{:.4}", res.final_score.unwrap_or(0.0));
                    if score_count.get(&score_str).copied().unwrap_or(0) > 1 {
                        all_tied.insert(res.candidate_id.clone());
                    }
                }

                // Count how many candidates share each tiebreak rank within a tie group
                let mut tb_rank_share: HashMap<(String, u32), usize> = HashMap::new();
                for res in gender_results.iter() {
                    if all_tied.contains(&res.candidate_id) {
                        let score_str = format!("{:.4}", res.final_score.unwrap_or(0.0));
                        let tb_rank = tb_rank_map.get(&res.candidate_id).copied().unwrap_or(u32::MAX);
                        *tb_rank_share.entry((score_str, tb_rank)).or_insert(0) += 1;
                    }
                }

                let mut still_tied: std::collections::HashSet<String> = std::collections::HashSet::new();
                for res in gender_results.iter() {
                    if all_tied.contains(&res.candidate_id) {
                        let score_str = format!("{:.4}", res.final_score.unwrap_or(0.0));
                        let tb_rank = tb_rank_map.get(&res.candidate_id).copied().unwrap_or(u32::MAX);
                        let share = tb_rank_share.get(&(score_str, tb_rank)).copied().unwrap_or(1);
                        // Still tied if: no tiebreak ran, or they share a tiebreak rank with another
                        if !tiebreak_scores_exist || share > 1 {
                            still_tied.insert(res.candidate_id.clone());
                        }
                    }
                }

                // Sort: primary = final_score ascending (lower Borda sum = better),
                //        secondary = tiebreak Borda rank ascending (lower = better, u32::MAX if no score).
                gender_results.sort_by(|a, b| {
                    let final_a = a.final_score.unwrap_or(f64::MAX);
                    let final_b = b.final_score.unwrap_or(f64::MAX);
                    match final_a.partial_cmp(&final_b).unwrap_or(std::cmp::Ordering::Equal) {
                        std::cmp::Ordering::Equal => {
                            let tb_a = tb_rank_map.get(&a.candidate_id).copied().unwrap_or(u32::MAX);
                            let tb_b = tb_rank_map.get(&b.candidate_id).copied().unwrap_or(u32::MAX);
                            tb_a.cmp(&tb_b)
                        }
                        ord => ord,
                    }
                });

                // Re-assign ranks with proper shared-rank handling for still-tied candidates.
                let mut current_rank: i64 = 1;
                let mut last_final = f64::MAX;
                let mut last_tb_rank = u32::MAX;
                for (i, res) in gender_results.iter_mut().enumerate() {
                    let this_final = res.final_score.unwrap_or(f64::MAX);
                    let this_tb_rank = tb_rank_map.get(&res.candidate_id).copied().unwrap_or(u32::MAX);

                    let same_as_prev = i > 0
                        && (this_final - last_final).abs() < f64::EPSILON
                        && this_tb_rank == last_tb_rank;

                    if !same_as_prev {
                        current_rank = (i + 1) as i64;
                    }
                    res.rank = Some(current_rank);
                    last_final = this_final;
                    last_tb_rank = this_tb_rank;
                }

                // Update is_in_tiebreak flag in candidates table.
                // Flagged = still tied (needs tiebreak Q&A run, or needs admin override after tiebreak also tied).
                // Cleared = tie fully resolved.
                for res in gender_results.iter() {
                    let should_flag = still_tied.contains(&res.candidate_id);
                    let _ = conn.execute(
                        "UPDATE candidates SET is_in_tiebreak = ?1 WHERE id = ?2",
                        rusqlite::params![if should_flag { 1 } else { 0 }, res.candidate_id],
                    );
                }
            };

            process_finals(&mut male_results);
            process_finals(&mut female_results);

            for r in male_results.iter().chain(female_results.iter()) {
                let _ = db::results::insert(&conn, r);
            }

            let _ = crate::db::logs::insert(
                &conn,
                &crate::db::logs::SystemLog {
                    id: uuid::Uuid::new_v4().to_string(),
                    level: "info".to_string(),
                    source: "admin".to_string(),
                    message: "Admin computed Final Winners results".to_string(),
                    details: None,
                    created_at: chrono::Utc::now().to_rfc3339(),
                },
            );

            Json(json!({
                "status": "success",
                "message": "Final winners computed."
            }))
        }
        "minor_awards" => {
            let candidates = db::candidates::get_all(&conn).unwrap_or_default();
            let scores = db::scores::get_all(&conn).unwrap_or_default();
            
            let mut candidate_genders = HashMap::new();
            for c in &candidates {
                candidate_genders.insert(c.id.clone(), c.gender.clone());
            }

            let minor_segments = vec![
                "best_advocacy", 
                "best_in_ramp"
            ];

            for segment in minor_segments {
                let mut segment_scores_by_judge: HashMap<String, Vec<crate::scoring::ranking::JudgeRawScore>> = HashMap::new();
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

                let best_male = male_consolidated.into_iter().find(|r| r.final_rank == 1).map(|r| r.candidate_id);
                let best_female = female_consolidated.into_iter().find(|r| r.final_rank == 1).map(|r| r.candidate_id);

                let award = db::special_awards::SpecialAward {
                    award_id: segment.to_string(),
                    winner_male_id: best_male,
                    winner_female_id: best_female,
                    is_auto_computed: true,
                    notes: None,
                    assigned_at: Some(now.clone()),
                };
                let _ = db::special_awards::insert_or_update(&conn, &award);
            }

            let _ = crate::db::logs::insert(
                &conn,
                &crate::db::logs::SystemLog {
                    id: uuid::Uuid::new_v4().to_string(),
                    level: "info".to_string(),
                    source: "admin".to_string(),
                    message: "Admin computed Minor Awards results".to_string(),
                    details: None,
                    created_at: chrono::Utc::now().to_rfc3339(),
                },
            );

            Json(json!({
                "status": "success",
                "message": "Minor awards computed using Borda Count."
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveTiePayload {
    pub pin: String,
    pub stage: String,
    pub resolutions: Vec<CandidateResolution>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidateResolution {
    pub candidate_id: String,
    pub resolution: String,
}

pub async fn resolve_tie(
    State(state): State<AppState>,
    Json(payload): Json<ResolveTiePayload>,
) -> (axum::http::StatusCode, Json<Value>) {
    let conn = state.db.lock().unwrap();
    if let Ok(Some(config)) = db::event::get(&conn) {
        if config.admin_pin != payload.pin {
            return (axum::http::StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid PIN"})));
        }
    } else {
        return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Config error"})));
    }

    let now = chrono::Utc::now().to_rfc3339();
    for res in &payload.resolutions {
        let sr = db::stage_resolutions::StageResolution {
            candidate_id: res.candidate_id.clone(),
            stage: payload.stage.clone(),
            resolution: res.resolution.clone(),
            created_at: now.clone(),
        };
        let _ = db::stage_resolutions::insert(&conn, &sr);
    }
    
    let _ = crate::db::logs::insert(
        &conn,
        &crate::db::logs::SystemLog {
            id: uuid::Uuid::new_v4().to_string(),
            level: "info".to_string(),
            source: "admin".to_string(),
            message: format!("Admin resolved tie for stage {} for {} candidates", payload.stage, payload.resolutions.len()),
            details: None,
            created_at: now,
        },
    );
    
    (axum::http::StatusCode::OK, Json(json!({"status": "success"})))
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
        "tie_breaking_qa",
        "best_advocacy",
        "best_in_ramp"
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
        
        for res in male_consolidated.into_iter().chain(female_consolidated) {
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
