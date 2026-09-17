use std::cmp::Ordering;
use std::collections::HashMap;
use crate::db::results::CandidateResult;

#[derive(Debug, Clone, PartialEq)]
pub struct JudgeRawScore {
    pub candidate_id: String,
    pub raw_score: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct JudgeRank {
    pub candidate_id: String,
    pub rank: u32,
    pub raw_score: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CandidateSegmentResult {
    pub candidate_id: String,
    pub rank_sum: u32,
    pub raw_score_sum: f64,
    pub final_rank: u32,
}

/// Converts a single judge's raw scores into ranks (1 to N).
/// Higher raw score = Rank 1.
pub fn rank_segment_scores(mut scores: Vec<JudgeRawScore>) -> Vec<JudgeRank> {
    scores.sort_by(|a, b| b.raw_score.partial_cmp(&a.raw_score).unwrap_or(Ordering::Equal));
    
    let mut ranks = Vec::new();
    let mut current_rank = 1;
    let mut last_score = -1.0;
    
    for (i, score) in scores.into_iter().enumerate() {
        let rank = if (score.raw_score - last_score).abs() < f64::EPSILON {
            current_rank
        } else {
            current_rank = (i + 1) as u32;
            current_rank
        };
        last_score = score.raw_score;
        
        ranks.push(JudgeRank {
            candidate_id: score.candidate_id,
            rank,
            raw_score: score.raw_score,
        });
    }
    
    ranks
}

/// Consolidates ranks across all judges per candidate.
/// Lowest rank_sum gets Rank 1.
/// Tie-breaker: Highest raw_score_sum.
pub fn consolidate_segment_ranks(judge_ranks: Vec<Vec<JudgeRank>>) -> Vec<CandidateSegmentResult> {
    let mut aggregates: HashMap<String, (u32, f64)> = HashMap::new();
    
    for judge in judge_ranks {
        for rank in judge {
            let entry = aggregates.entry(rank.candidate_id).or_insert((0, 0.0));
            entry.0 += rank.rank;
            entry.1 += rank.raw_score;
        }
    }
    
    let mut results: Vec<_> = aggregates.into_iter().map(|(id, (rank_sum, raw_score_sum))| {
        CandidateSegmentResult {
            candidate_id: id,
            rank_sum,
            raw_score_sum,
            final_rank: 0,
        }
    }).collect();
    
    // Sort by lowest rank_sum, then highest raw_score_sum
    results.sort_by(|a, b| {
        match a.rank_sum.cmp(&b.rank_sum) {
            Ordering::Equal => b.raw_score_sum.partial_cmp(&a.raw_score_sum).unwrap_or(Ordering::Equal),
            other => other,
        }
    });
    
    let mut current_rank = 1;
    let mut last_rank_sum = 0;
    let mut last_raw_score_sum = -1.0;
    
    for (i, res) in results.iter_mut().enumerate() {
        let is_tie = res.rank_sum == last_rank_sum && (res.raw_score_sum - last_raw_score_sum).abs() < f64::EPSILON;
        
        if is_tie {
            res.final_rank = current_rank;
        } else {
            current_rank = (i + 1) as u32;
            res.final_rank = current_rank;
        }
        
        last_rank_sum = res.rank_sum;
        last_raw_score_sum = res.raw_score_sum;
    }
    
    results
}

// Sort candidates by Borda score (lower is better). Assigns equal ranks to tied candidates.
pub fn rank_candidates(candidates: &mut [CandidateResult]) {
    candidates.sort_by(|a, b| {
        // Lower is better in Borda count
        let final_a = a.final_score.unwrap_or(f64::MAX);
        let final_b = b.final_score.unwrap_or(f64::MAX);

        match final_a.partial_cmp(&final_b) {
            Some(Ordering::Equal) | None => {
                let prelim_a = a.preliminary_score.unwrap_or(f64::MAX);
                let prelim_b = b.preliminary_score.unwrap_or(f64::MAX);
                prelim_a.partial_cmp(&prelim_b).unwrap_or(Ordering::Equal)
            }
            Some(ord) => ord,
        }
    });

    // Assign ranks with proper tie handling: tied candidates share the same rank
    let mut current_rank: i64 = 1;
    for i in 0..candidates.len() {
        if i == 0 {
            candidates[i].rank = Some(current_rank);
        } else {
            let prev_prelim = candidates[i - 1].preliminary_score.unwrap_or(f64::MAX);
            let curr_prelim = candidates[i].preliminary_score.unwrap_or(f64::MAX);
            let prev_final = candidates[i - 1].final_score.unwrap_or(f64::MAX);
            let curr_final = candidates[i].final_score.unwrap_or(f64::MAX);

            let is_tie = (prev_prelim - curr_prelim).abs() < f64::EPSILON
                && (prev_final - curr_final).abs() < f64::EPSILON;

            if !is_tie {
                current_rank = (i + 1) as i64;
            }
            candidates[i].rank = Some(current_rank);
        }
    }
}

/// Flags Top 3 candidates, with tie handling at the boundary.
/// If a tie exists at the boundary and exceeds available slots, sets status to 'pending_override'.
/// Returns true if ANY candidate needs an admin override.
pub fn select_top3(candidates: &mut [CandidateResult], overrides: &HashMap<String, String>) -> bool {
    let target_slots = 3;
    if candidates.len() <= target_slots {
        for c in candidates.iter_mut() {
            c.preliminary_status = "advancing".to_string();
        }
        return false;
    }

    // Find the rank of the 3rd-place candidate
    let boundary_rank = candidates[target_slots - 1].rank.unwrap_or(999);

    let mut strictly_better = 0;
    let mut at_boundary = 0;
    
    for c in candidates.iter() {
        let rank = c.rank.unwrap_or(999);
        if rank < boundary_rank {
            strictly_better += 1;
        } else if rank == boundary_rank {
            at_boundary += 1;
        }
    }

    let available_boundary_slots = target_slots - strictly_better;
    let has_boundary_tie = at_boundary > available_boundary_slots;
    
    let mut needs_override_global = false;

    for candidate in candidates.iter_mut() {
        let rank = candidate.rank.unwrap_or(999);
        if rank < boundary_rank {
            candidate.preliminary_status = "advancing".to_string();
        } else if rank == boundary_rank {
            if has_boundary_tie {
                if let Some(decision) = overrides.get(&candidate.candidate_id) {
                    if decision == "advance" {
                        candidate.preliminary_status = "advancing".to_string();
                    } else if decision == "exclude" {
                        candidate.preliminary_status = "excluded".to_string();
                    }
                } else {
                    candidate.preliminary_status = "pending_override".to_string();
                    needs_override_global = true;
                }
            } else {
                candidate.preliminary_status = "advancing".to_string();
            }
        } else {
            candidate.preliminary_status = "excluded".to_string();
        }
    }

    needs_override_global
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_fixture_rc_1() {
        let raw_scores = vec![
            JudgeRawScore { candidate_id: "A".to_string(), raw_score: 88.0 },
            JudgeRawScore { candidate_id: "B".to_string(), raw_score: 95.0 },
            JudgeRawScore { candidate_id: "C".to_string(), raw_score: 72.0 },
        ];
        let ranks = rank_segment_scores(raw_scores);
        
        let a = ranks.iter().find(|r| r.candidate_id == "A").unwrap();
        let b = ranks.iter().find(|r| r.candidate_id == "B").unwrap();
        let c = ranks.iter().find(|r| r.candidate_id == "C").unwrap();
        
        assert_eq!(b.rank, 1);
        assert_eq!(a.rank, 2);
        assert_eq!(c.rank, 3);
    }

    #[test]
    fn test_fixture_bc_1() {
        let j1 = vec![
            JudgeRank { candidate_id: "A".to_string(), rank: 1, raw_score: 90.0 },
            JudgeRank { candidate_id: "B".to_string(), rank: 2, raw_score: 80.0 },
        ];
        let j2 = vec![
            JudgeRank { candidate_id: "A".to_string(), rank: 2, raw_score: 85.0 },
            JudgeRank { candidate_id: "B".to_string(), rank: 1, raw_score: 95.0 },
        ];
        let j3 = vec![
            JudgeRank { candidate_id: "A".to_string(), rank: 2, raw_score: 88.0 },
            JudgeRank { candidate_id: "B".to_string(), rank: 1, raw_score: 92.0 },
        ];

        let results = consolidate_segment_ranks(vec![j1, j2, j3]);
        
        let a = results.iter().find(|r| r.candidate_id == "A").unwrap();
        let b = results.iter().find(|r| r.candidate_id == "B").unwrap();
        
        assert_eq!(a.rank_sum, 5);
        assert_eq!(b.rank_sum, 4);
        assert_eq!(results[0].candidate_id, "B");
        assert_eq!(results[0].final_rank, 1);
    }

    #[test]
    fn test_fixture_tb_1() {
        let j1 = vec![
            JudgeRank { candidate_id: "A".to_string(), rank: 6, raw_score: 250.0 },
        ];
        let j2 = vec![
            JudgeRank { candidate_id: "B".to_string(), rank: 6, raw_score: 265.0 },
        ];

        let results = consolidate_segment_ranks(vec![j1, j2]);
        
        assert_eq!(results[0].candidate_id, "B");
        assert_eq!(results[0].final_rank, 1);
        assert_eq!(results[1].candidate_id, "A");
        assert_eq!(results[1].final_rank, 2);
    }

    #[test]
    fn test_fixture_bt_1() {
        let mut candidates = vec![
            CandidateResult { candidate_id: "C1".to_string(), segment_id: None, preliminary_score: Some(1.0), preliminary_rank: None, preliminary_status: "".to_string(), final_qa_score: None, final_score: None, rank: Some(1), computed_at: "".to_string() },
            CandidateResult { candidate_id: "C2".to_string(), segment_id: None, preliminary_score: Some(2.0), preliminary_rank: None, preliminary_status: "".to_string(), final_qa_score: None, final_score: None, rank: Some(2), computed_at: "".to_string() },
            CandidateResult { candidate_id: "C3".to_string(), segment_id: None, preliminary_score: Some(2.4), preliminary_rank: None, preliminary_status: "".to_string(), final_qa_score: None, final_score: None, rank: Some(3), computed_at: "".to_string() },
            CandidateResult { candidate_id: "C4".to_string(), segment_id: None, preliminary_score: Some(2.4), preliminary_rank: None, preliminary_status: "".to_string(), final_qa_score: None, final_score: None, rank: Some(3), computed_at: "".to_string() },
        ];
        
        let overrides = HashMap::new();
        let needs_override = select_top3(&mut candidates, &overrides);
        
        assert_eq!(needs_override, true);
        
        let c3 = candidates.iter().find(|c| c.candidate_id == "C3").unwrap();
        let c4 = candidates.iter().find(|c| c.candidate_id == "C4").unwrap();
        
        assert_eq!(c3.preliminary_status, "pending_override");
        assert_eq!(c4.preliminary_status, "pending_override");
    }

    #[test]
    fn test_fixture_ft_1() {
        let mut candidates = vec![
            CandidateResult { candidate_id: "F1".to_string(), segment_id: None, preliminary_score: Some(1.2), preliminary_rank: None, preliminary_status: "".to_string(), final_qa_score: None, final_score: Some(1.2), rank: None, computed_at: "".to_string() },
            CandidateResult { candidate_id: "F2".to_string(), segment_id: None, preliminary_score: Some(1.8), preliminary_rank: None, preliminary_status: "".to_string(), final_qa_score: None, final_score: Some(1.4), rank: None, computed_at: "".to_string() },
            CandidateResult { candidate_id: "F3".to_string(), segment_id: None, preliminary_score: Some(1.8), preliminary_rank: None, preliminary_status: "".to_string(), final_qa_score: None, final_score: Some(1.4), rank: None, computed_at: "".to_string() },
        ];
        
        rank_candidates(&mut candidates);
        
        let f1 = candidates.iter().find(|c| c.candidate_id == "F1").unwrap();
        let f2 = candidates.iter().find(|c| c.candidate_id == "F2").unwrap();
        let f3 = candidates.iter().find(|c| c.candidate_id == "F3").unwrap();
        
        assert_eq!(f1.rank, Some(1));
        assert_eq!(f2.rank, Some(2));
        assert_eq!(f3.rank, Some(2));
    }
}
