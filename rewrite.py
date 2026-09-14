import re

with open("src-tauri/src/server/admin_routes.rs", "r") as f:
    content = f.read()

new_code = """
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

    crate::scoring::ranking::rank_candidates(&mut female_results);
    apply_top3(&mut female_results);

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

    let mut process_finals = |gender_results: &mut Vec<db::results::CandidateResult>| {
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

        let prelim_rank = res.rank.unwrap_or(0) as f64;
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
"""

start_token = "pub async fn compute_results("
end_token = "pub async fn get_results(State(state): State<AppState>) -> Json<Value> {"

start_idx = content.find(start_token)
end_idx = content.find(end_token)

if start_idx != -1 and end_idx != -1:
    result = content[:start_idx] + new_code + "\n" + content[end_idx:]
    with open("src-tauri/src/server/admin_routes.rs", "w") as f:
        f.write(result)
    print("Replaced successfully")
else:
    print("Could not find boundaries")
