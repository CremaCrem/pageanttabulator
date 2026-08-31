use crate::db::results::CandidateResult;
use std::cmp::Ordering;

// Sorts candidates descending by score. Tie-breaker is preliminary score.
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

// Selects top 5 candidates. Assumes the slice is already sorted descending by preliminary score.
pub fn select_top5(candidates: &mut [CandidateResult]) {
    for (i, candidate) in candidates.iter_mut().enumerate() {
        if i < 5 {
            candidate.is_top5 = true;
        } else {
            candidate.is_top5 = false;
        }
    }
}
