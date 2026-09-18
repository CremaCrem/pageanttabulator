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


fn save_computation_results(conn: &rusqlite::Connection, results: &[db::results::CandidateResult]) -> Result<(), Box<dyn std::error::Error>> {
    for r in results {
        db::results::insert(conn, r)?;
    }
    Ok(())
}

fn compute_preliminary_results(conn: &rusqlite::Connection, now: &str) -> Result<(), Box<dyn std::error::Error>> {
    let candidates = db::candidates::get_all(conn).unwrap_or_default();
    let scores = db::scores::get_all(conn).unwrap_or_default();

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

    let mut candidate_prelim_ranks: HashMap<String, Vec<f64>> = HashMap::new();

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
            segment_id: Some("".to_string()),
            preliminary_score: Some(prelim_score),
            preliminary_rank: None,
            preliminary_status: "pending".to_string(),
            final_qa_score: None,
            final_score: None,
            rank: None,
            computed_at: now.to_string(),
        };

        if c.gender == "male" {
            male_results.push(res);
        } else if c.gender == "female" {
            female_results.push(res);
        }
    }

    let resolutions = db::stage_resolutions::get_by_stage(conn, "preliminary_boundary").unwrap_or_default();
    let mut overrides = std::collections::HashMap::new();
    for r in resolutions {
        overrides.insert(r.candidate_id, r.resolution);
    }

    let apply_top3 = |results: &mut Vec<db::results::CandidateResult>| {
        crate::scoring::ranking::select_top3(results, &overrides);
    };

    crate::scoring::ranking::rank_candidates(&mut male_results);
    apply_top3(&mut male_results);
    for res in &mut male_results {
        res.preliminary_rank = res.rank;
        res.rank = None;
    }

    crate::scoring::ranking::rank_candidates(&mut female_results);
    apply_top3(&mut female_results);
    for res in &mut female_results {
        res.preliminary_rank = res.rank;
        res.rank = None;
    }

    let mut all_results = Vec::new();
    all_results.extend(male_results);
    all_results.extend(female_results);

    save_computation_results(conn, &all_results)?;

    let _ = crate::db::logs::insert(
        conn,
        &crate::db::logs::SystemLog {
            id: uuid::Uuid::new_v4().to_string(),
            level: "info".to_string(),
            source: "admin".to_string(),
            message: "Admin computed Preliminary results".to_string(),
            details: None,
            created_at: now.to_string(),
        },
    );

    Ok(())
}

fn compute_tiebreak_results(conn: &rusqlite::Connection, scores: &[db::scores::Score], male_results: &mut Vec<db::results::CandidateResult>, female_results: &mut Vec<db::results::CandidateResult>) {
    let mut tiebreak_scores_exist = false;
    for score in scores {
        if score.segment_id == "tie_breaking_qa" {
            tiebreak_scores_exist = true;
            break;
        }
    }

    let process_finals = |gender_results: &mut Vec<db::results::CandidateResult>| {
        let mut tb_rank_map: HashMap<String, u32> = HashMap::new();

        if tiebreak_scores_exist {
            let mut score_count: HashMap<String, usize> = HashMap::new();
            for res in gender_results.iter() {
                let score_str = format!("{:.4}", res.final_score.unwrap_or(0.0));
                *score_count.entry(score_str).or_insert(0) += 1;
            }

            let mut tie_groups: HashMap<String, Vec<String>> = HashMap::new();
            for res in gender_results.iter() {
                let score_str = format!("{:.4}", res.final_score.unwrap_or(0.0));
                if score_count.get(&score_str).copied().unwrap_or(0) > 1 {
                    tie_groups.entry(score_str).or_default().push(res.candidate_id.clone());
                }
            }

            for group_ids in tie_groups.values() {
                let mut segment_scores_by_judge: HashMap<String, Vec<crate::scoring::ranking::JudgeRawScore>> = HashMap::new();
                for score in scores {
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
            }
        }

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
                if !tiebreak_scores_exist || share > 1 {
                    still_tied.insert(res.candidate_id.clone());
                }
            }
        }

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

        for res in gender_results.iter() {
            let should_flag = still_tied.contains(&res.candidate_id);
            let _ = conn.execute(
                "UPDATE candidates SET is_in_tiebreak = ?1 WHERE id = ?2",
                rusqlite::params![if should_flag { 1 } else { 0 }, res.candidate_id],
            );
        }
    };

    process_finals(male_results);
    process_finals(female_results);
}

fn compute_finals_results(conn: &rusqlite::Connection, now: &str) -> Result<(), Box<dyn std::error::Error>> {
    let candidates = db::candidates::get_all(conn).unwrap_or_default();
    let mut results = db::results::get_overall_results(conn).unwrap_or_default();
    let scores = db::scores::get_all(conn).unwrap_or_default();

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

        let gender = candidates
            .iter()
            .find(|c| c.id == res.candidate_id)
            .map(|c| c.gender.as_str())
            .unwrap_or("");

        let final_qa_rank_val = final_qa_ranks.get(&res.candidate_id).copied().unwrap_or(0);
        res.final_qa_score = Some(final_qa_rank_val as f64);

        let prelim_rank = res.preliminary_rank.unwrap_or(0) as f64;
        res.final_score = Some(crate::scoring::compute::compute_final_score(
            prelim_rank,
            final_qa_rank_val as f64,
        ));
        res.computed_at = now.to_string();

        if gender == "male" {
            male_results.push(res.clone());
        } else if gender == "female" {
            female_results.push(res.clone());
        }
    }

    compute_tiebreak_results(conn, &scores, &mut male_results, &mut female_results);

    let mut all_results = Vec::new();
    all_results.extend(male_results);
    all_results.extend(female_results);

    save_computation_results(conn, &all_results)?;

    let _ = crate::db::logs::insert(
        conn,
        &crate::db::logs::SystemLog {
            id: uuid::Uuid::new_v4().to_string(),
            level: "info".to_string(),
            source: "admin".to_string(),
            message: "Admin computed Final Winners results".to_string(),
            details: None,
            created_at: now.to_string(),
        },
    );

    Ok(())
}

fn compute_minor_awards_results(conn: &rusqlite::Connection, now: &str) -> Result<(), Box<dyn std::error::Error>> {
    let candidates = db::candidates::get_all(conn).unwrap_or_default();
    let scores = db::scores::get_all(conn).unwrap_or_default();
    
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
            assigned_at: Some(now.to_string()),
        };
        let _ = db::special_awards::insert_or_update(conn, &award);
    }

    let _ = crate::db::logs::insert(
        conn,
        &crate::db::logs::SystemLog {
            id: uuid::Uuid::new_v4().to_string(),
            level: "info".to_string(),
            source: "admin".to_string(),
            message: "Admin computed Minor Awards results".to_string(),
            details: None,
            created_at: now.to_string(),
        },
    );

    Ok(())
}

pub async fn compute_results(
    State(state): State<AppState>,
    Json(payload): Json<ComputeResultsPayload>,
) -> Json<Value> {
    let conn = state.db.lock().unwrap();
    let now = chrono::Utc::now().to_rfc3339();

    match payload.round.as_str() {
        "preliminary" => {
            if let Err(e) = compute_preliminary_results(&conn, &now) {
                return Json(json!({"status": "error", "message": format!("Failed: {}", e)}));
            }
            Json(json!({
                "status": "success",
                "message": "Preliminary results computed."
            }))
        }
        "final" => {
            if let Err(e) = compute_finals_results(&conn, &now) {
                return Json(json!({"status": "error", "message": format!("Failed: {}", e)}));
            }
            Json(json!({
                "status": "success",
                "message": "Final winners computed."
            }))
        }
        "minor_awards" => {
            if let Err(e) = compute_minor_awards_results(&conn, &now) {
                return Json(json!({"status": "error", "message": format!("Failed: {}", e)}));
            }
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualScoreEntryPayload {
    pub pin: String,
    pub judge_id: String,
    pub candidate_id: String,
    pub segment_id: String,
    pub criteria_entries: Vec<crate::server::score_routes::CriterionEntry>,
}

/// Shared gate for the two admin score-writing paths: PIN, segment validity, criteria
/// completeness, and 1-100 range. Returns the error response to send, or None to proceed.
fn validate_admin_score_write(
    conn: &rusqlite::Connection,
    pin: &str,
    segment_id: &str,
    entries: &[crate::server::score_routes::CriterionEntry],
) -> Option<(axum::http::StatusCode, Json<Value>)> {
    // a. Validate PIN
    match db::event::get(conn) {
        Ok(Some(config)) => {
            if config.admin_pin != pin {
                return Some((axum::http::StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid PIN"}))));
            }
        }
        _ => {
            return Some((axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Config error"}))));
        }
    }

    // b. Validate criteria completeness
    let expected_criteria = crate::scoring::compute::get_segment_criteria_ids(segment_id);
    if expected_criteria.is_empty() {
        return Some((axum::http::StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid segment"}))));
    }

    if entries.len() != expected_criteria.len() {
        return Some((axum::http::StatusCode::BAD_REQUEST, Json(json!({"error": "All criteria are required for this segment"}))));
    }

    let submitted: std::collections::HashSet<&str> =
        entries.iter().map(|e| e.criterion_id.as_str()).collect();
    let expected_set: std::collections::HashSet<&str> = expected_criteria.into_iter().collect();
    if submitted != expected_set {
        return Some((axum::http::StatusCode::BAD_REQUEST, Json(json!({"error": "All criteria are required for this segment"}))));
    }

    // c. Validate score ranges
    for entry in entries {
        if entry.score < 1 || entry.score > 100 {
            return Some((axum::http::StatusCode::BAD_REQUEST, Json(json!({"error": "Scores must be between 1 and 100"}))));
        }
    }

    None
}

pub async fn manual_score_entry(
    State(state): State<AppState>,
    Json(payload): Json<ManualScoreEntryPayload>,
) -> (axum::http::StatusCode, Json<Value>) {
    let conn = state.db.lock().unwrap();

    if let Some(err) = validate_admin_score_write(&conn, &payload.pin, &payload.segment_id, &payload.criteria_entries) {
        return err;
    }

    // d. Duplicate check
    if let Ok(existing_scores) = db::scores::get_by_judge(&conn, &payload.judge_id) {
        let is_duplicate = existing_scores
            .iter()
            .any(|s| s.segment_id == payload.segment_id && s.candidate_id == payload.candidate_id);
            
        if is_duplicate {
            return (axum::http::StatusCode::BAD_REQUEST, Json(json!({"error": "Score already submitted for this candidate in this segment."})));
        }
    }
    
    // e. Compute score and insert
    let computed = crate::scoring::compute::compute_segment_score(&payload.segment_id, &payload.criteria_entries);
    let now = chrono::Utc::now().to_rfc3339();
    let score_id = uuid::Uuid::new_v4().to_string();
    
    // Get current judge name for historical snapshotting
    let judge_name = if let Ok(Some(judge)) = db::judges::get_by_id(&conn, &payload.judge_id) {
        judge.name
    } else {
        None
    };

    let score = db::scores::Score {
        id: score_id.clone(),
        judge_id: payload.judge_id.clone(),
        judge_name,
        candidate_id: payload.candidate_id.clone(),
        segment_id: payload.segment_id.clone(),
        criteria_json: serde_json::to_string(&payload.criteria_entries).unwrap_or_else(|_| "[]".to_string()),
        computed_score: computed,
        submitted_at: now.clone(),
    };
    
    if let Err(_) = db::scores::insert(&conn, &score) {
        return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to save score"})));
    }
    
    // f. Write log
    let _ = db::logs::insert(&conn, &db::logs::SystemLog {
        id: uuid::Uuid::new_v4().to_string(),
        level: "info".to_string(),
        source: "admin".to_string(),
        message: format!("Admin manually entered score for Judge {} \u{2014} Candidate {} (Segment: {})", payload.judge_id, payload.candidate_id, payload.segment_id),
        details: None,
        created_at: now.clone(),
    });
    
    // g. Return success
    (
        axum::http::StatusCode::OK,
        Json(json!({
            "scoreId": score_id,
            "computedScore": computed,
            "submittedAt": now
        }))
    )
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectScorePayload {
    pub pin: String,
    pub judge_id: String,
    pub candidate_id: String,
    pub segment_id: String,
    pub criteria_entries: Vec<crate::server::score_routes::CriterionEntry>,
    pub reason: String,
}

/// Admin score correction, on a judge's behalf.
///
/// Judges can never edit their own submitted score; the approved chain is judge requests →
/// Admin consults coordinator + auditor → Admin corrects here. See
/// `docs/scoped/scoring-logic.md` §2.1. Rewrites the existing row in place so downstream
/// Borda math still sees exactly one score per judge/candidate/segment.
pub async fn correct_score(
    State(state): State<AppState>,
    Json(payload): Json<CorrectScorePayload>,
) -> (axum::http::StatusCode, Json<Value>) {
    let conn = state.db.lock().unwrap();

    if let Some(err) = validate_admin_score_write(&conn, &payload.pin, &payload.segment_id, &payload.criteria_entries) {
        return err;
    }

    // A reason is mandatory — this is the audit trail for an override of a locked score.
    if payload.reason.trim().is_empty() {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            Json(json!({"error": "A reason is required to correct a submitted score", "code": "REASON_REQUIRED"})),
        );
    }

    // Unlike manual entry, a correction REQUIRES an existing score to overwrite.
    let existing = match db::scores::get_one(&conn, &payload.judge_id, &payload.candidate_id, &payload.segment_id) {
        Ok(Some(s)) => s,
        Ok(None) => {
            return (
                axum::http::StatusCode::NOT_FOUND,
                Json(json!({"error": "No submitted score exists for this judge, candidate and segment. Use Manual Score Entry instead.", "code": "NO_EXISTING_SCORE"})),
            );
        }
        Err(e) => {
            eprintln!("correct_score lookup failed: {}", e);
            return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to read existing score"})));
        }
    };

    let new_computed = crate::scoring::compute::compute_segment_score(&payload.segment_id, &payload.criteria_entries);
    let criteria_json = serde_json::to_string(&payload.criteria_entries).unwrap_or_else(|_| "[]".to_string());
    let now = chrono::Utc::now().to_rfc3339();

    match db::scores::update_criteria(&conn, &existing.id, &criteria_json, new_computed, &now) {
        Ok(0) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Score row vanished before it could be corrected"})),
        ),
        Ok(_) => {
            let _ = crate::db::logs::insert(
                &conn,
                &crate::db::logs::SystemLog {
                    id: uuid::Uuid::new_v4().to_string(),
                    level: "warn".to_string(),
                    source: "admin".to_string(),
                    message: format!(
                        "Admin CORRECTED score for judge {} / candidate {} in segment {}",
                        payload.judge_id, payload.candidate_id, payload.segment_id
                    ),
                    details: Some(format!(
                        "Previous: {} ({}) | New: {} ({}) | Reason: {}",
                        existing.computed_score, existing.criteria_json, new_computed, criteria_json, payload.reason.trim()
                    )),
                    created_at: now.clone(),
                },
            );

            let _ = state.ws_sender.send(json!({
                "type": "SCORE_CORRECTED",
                "judgeId": payload.judge_id,
                "candidateId": payload.candidate_id,
                "segmentId": payload.segment_id
            }));

            (
                axum::http::StatusCode::OK,
                Json(json!({
                    "status": "success",
                    "scoreId": existing.id,
                    "previousScore": existing.computed_score,
                    "computedScore": new_computed,
                    "correctedAt": now
                })),
            )
        }
        Err(e) => {
            eprintln!("correct_score update failed: {}", e);
            (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to correct score"})))
        }
    }
}
