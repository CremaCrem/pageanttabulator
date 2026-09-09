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

// Keep old for now to not break everything immediately, but we will change this soon.
pub fn rank_candidates(candidates: &mut [CandidateResult]) {
    candidates.sort_by(|a, b| {
        let final_a = a.final_score.unwrap_or(0.0);
        let final_b = b.final_score.unwrap_or(0.0);

        match final_b.partial_cmp(&final_a) {
            Some(Ordering::Equal) | None => {
                let prelim_a = a.preliminary_score.unwrap_or(0.0);
                let prelim_b = b.preliminary_score.unwrap_or(0.0);
                prelim_b.partial_cmp(&prelim_a).unwrap_or(Ordering::Equal)
            }
            Some(ord) => ord,
        }
    });

    for (i, candidate) in candidates.iter_mut().enumerate() {
        candidate.rank = Some((i + 1) as i64);
    }
}

pub fn select_top3(candidates: &mut [CandidateResult]) {
    for (i, candidate) in candidates.iter_mut().enumerate() {
        if i < 3 {
            candidate.is_top5 = true; // Still using is_top5 field from old schema until Phase 2
        } else {
            candidate.is_top5 = false;
        }
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
