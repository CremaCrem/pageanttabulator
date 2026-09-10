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
/// If the candidate at rank 3 shares the same preliminary_score as the
/// candidate at rank 4 (or lower), all tied candidates are included.
pub fn select_top3(candidates: &mut [CandidateResult]) {
    if candidates.len() <= 3 {
        for c in candidates.iter_mut() {
            c.is_top3 = true;
        }
        return;
    }

    // Find the preliminary score of the 3rd-place candidate (index 2)
    let third_place_score = candidates[2].preliminary_score.unwrap_or(f64::MAX);

    for candidate in candidates.iter_mut() {
        let score = candidate.preliminary_score.unwrap_or(f64::MAX);
        // Include if score is better than or equal to 3rd place (lower is better)
        candidate.is_top3 = score <= third_place_score + f64::EPSILON;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rank_segment_scores() {
        let raw_scores = vec![
            JudgeRawScore { candidate_id: "c1".to_string(), raw_score: 95.0 },
            JudgeRawScore { candidate_id: "c2".to_string(), raw_score: 90.0 },
            JudgeRawScore { candidate_id: "c3".to_string(), raw_score: 95.0 }, // Tie with c1
            JudgeRawScore { candidate_id: "c4".to_string(), raw_score: 80.0 },
        ];

        let ranks = rank_segment_scores(raw_scores);
        
        assert_eq!(ranks[0].candidate_id, "c1"); // or c3
        assert_eq!(ranks[0].rank, 1);
        
        assert_eq!(ranks[1].rank, 1); // Also rank 1 due to tie
        
        // Next is c2, rank should be 3
        assert_eq!(ranks[2].candidate_id, "c2");
        assert_eq!(ranks[2].rank, 3);
        
        // Next is c4, rank should be 4
        assert_eq!(ranks[3].candidate_id, "c4");
        assert_eq!(ranks[3].rank, 4);
    }

    #[test]
    fn test_consolidate_segment_ranks_with_tiebreak() {
        let judge1 = vec![
            JudgeRank { candidate_id: "A".to_string(), rank: 1, raw_score: 95.0 },
            JudgeRank { candidate_id: "B".to_string(), rank: 2, raw_score: 90.0 },
        ];
        
        let judge2 = vec![
            JudgeRank { candidate_id: "B".to_string(), rank: 1, raw_score: 98.0 },
            JudgeRank { candidate_id: "A".to_string(), rank: 2, raw_score: 91.0 },
        ];

        let results = consolidate_segment_ranks(vec![judge1, judge2]);
        
        // A: rank_sum = 3, raw_score_sum = 186.0
        // B: rank_sum = 3, raw_score_sum = 188.0
        
        assert_eq!(results.len(), 2);
        // B should win due to higher raw_score_sum tiebreaker
        assert_eq!(results[0].candidate_id, "B");
        assert_eq!(results[0].final_rank, 1);
        
        assert_eq!(results[1].candidate_id, "A");
        assert_eq!(results[1].final_rank, 2);
    }
}
