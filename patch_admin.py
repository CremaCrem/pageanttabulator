with open("src-tauri/src/server/admin_routes.rs", "r") as f:
    content = f.read()

# 1. compute_preliminary_results: after apply_top3, move rank to preliminary_rank
old_apply_male = """    crate::scoring::ranking::rank_candidates(&mut male_results);
    apply_top3(&mut male_results);"""
new_apply_male = """    crate::scoring::ranking::rank_candidates(&mut male_results);
    apply_top3(&mut male_results);
    for res in &mut male_results {
        res.preliminary_rank = res.rank;
        res.rank = None;
    }"""
content = content.replace(old_apply_male, new_apply_male)

old_apply_female = """    crate::scoring::ranking::rank_candidates(&mut female_results);
    apply_top3(&mut female_results);"""
new_apply_female = """    crate::scoring::ranking::rank_candidates(&mut female_results);
    apply_top3(&mut female_results);
    for res in &mut female_results {
        res.preliminary_rank = res.rank;
        res.rank = None;
    }"""
content = content.replace(old_apply_female, new_apply_female)

# 2. compute_finals_results: use preliminary_rank instead of rank
old_final_rank = """        let prelim_rank = res.rank.unwrap_or(0) as f64;"""
new_final_rank = """        let prelim_rank = res.preliminary_rank.unwrap_or(0) as f64;"""
content = content.replace(old_final_rank, new_final_rank)

# 3. compute_preliminary_results initialization
old_init_res = """        let res = db::results::CandidateResult {
            candidate_id: c.id.clone(),
            segment_id: Some("".to_string()),
            preliminary_score: Some(prelim_score),
            preliminary_status: "pending".to_string(),
            final_qa_score: None,
            final_score: None,
            rank: None,
            computed_at: now.to_string(),
        };"""
new_init_res = """        let res = db::results::CandidateResult {
            candidate_id: c.id.clone(),
            segment_id: Some("".to_string()),
            preliminary_score: Some(prelim_score),
            preliminary_rank: None,
            preliminary_status: "pending".to_string(),
            final_qa_score: None,
            final_score: None,
            rank: None,
            computed_at: now.to_string(),
        };"""
content = content.replace(old_init_res, new_init_res)

with open("src-tauri/src/server/admin_routes.rs", "w") as f:
    f.write(content)
print("admin_routes.rs patched")
