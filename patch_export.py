with open("src-tauri/src/commands/export.rs", "r") as f:
    content = f.read()

# 1. Remove the entire dynamic prelim_ranks computation block
old_dynamic_block = """        // Compute preliminary ranks dynamically for display FIRST
        let mut prelim_ranks = std::collections::HashMap::new();
        let mut prelim_scores_copy: Vec<_> = candidates.iter().map(|c| {
            let res = results.iter().find(|r| r.candidate_id == c.id);
            let score = res.and_then(|r| r.preliminary_score).unwrap_or(999.0);
            (c.id.clone(), score)
        }).collect();
        prelim_scores_copy.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
        let mut current_rank = 1;
        let mut last_score = -1.0;
        for (i, (id, score)) in prelim_scores_copy.iter().enumerate() {
            if (score - last_score).abs() > f64::EPSILON {
                current_rank = i + 1;
            }
            last_score = *score;
            prelim_ranks.insert(id.clone(), current_rank);
        }"""
new_dynamic_block = """        // Using the reliable preliminary_rank column directly from results"""
content = content.replace(old_dynamic_block, new_dynamic_block)

# 2. Replace the read of prelim_ranks in the Male results section
old_p_rank_male = """            let p_rank = prelim_ranks.get(&c.id).copied().unwrap_or(999);
            row.push_element(elements::Paragraph::new(format!("{:.0}", p_rank)));"""
new_p_rank_male = """            let p_rank = res.preliminary_rank.unwrap_or(999);
            row.push_element(elements::Paragraph::new(format!("{:.0}", p_rank)));"""
content = content.replace(old_p_rank_male, new_p_rank_male)

# 3. Replace the read of prelim_ranks in the Female results section
old_p_rank_female = """            let p_rank = prelim_ranks.get(&c.id).copied().unwrap_or(999);
            row2.push_element(elements::Paragraph::new(p_rank.to_string()));"""
new_p_rank_female = """            let p_rank = res.preliminary_rank.unwrap_or(999);
            row2.push_element(elements::Paragraph::new(p_rank.to_string()));"""
content = content.replace(old_p_rank_female, new_p_rank_female)

with open("src-tauri/src/commands/export.rs", "w") as f:
    f.write(content)
print("export.rs patched")
