use crate::server::score_routes::CriterionEntry;

pub fn get_criterion_weight(segment_id: &str, criterion_id: &str) -> f64 {
    match (segment_id, criterion_id) {
        // Production Number
        ("production_number", "stage_presence") => 0.40,
        ("production_number", "energy") => 0.30,
        ("production_number", "audience_engagement") => 0.20,
        ("production_number", "overall_appeal") => 0.10,

        // School Uniform
        ("school_uniform", "neatness") => 0.25,
        ("school_uniform", "confidence_bearing") => 0.25,
        ("school_uniform", "advocacy") => 0.25,
        ("school_uniform", "overall_impact") => 0.25,

        // Professional Attire
        ("professional_attire", "elegance_professionalism") => 0.35,
        ("professional_attire", "suitability") => 0.25,
        ("professional_attire", "confidence_stage") => 0.20,
        ("professional_attire", "overall_impact") => 0.20,

        // Modern Barong / Filipiniana
        ("modern_barong", "elegance_poise") => 0.35,
        ("modern_barong", "suitability_creativity") => 0.25,
        ("modern_barong", "confidence_stage") => 0.20,
        ("modern_barong", "overall_impact") => 0.20,

        // Preliminary Q&A, Final Q&A, & Tie-Breaking Q&A
        ("preliminary_qa", "content_substance") | ("final_qa", "content_substance") | ("tie_breaking_qa", "content_substance") => 0.40,
        ("preliminary_qa", "clarity_organization") | ("final_qa", "clarity_organization") | ("tie_breaking_qa", "clarity_organization") => 0.25,
        ("preliminary_qa", "confidence_delivery") | ("final_qa", "confidence_delivery") | ("tie_breaking_qa", "confidence_delivery") => 0.20,
        ("preliminary_qa", "relevance") | ("final_qa", "relevance") | ("tie_breaking_qa", "relevance") => 0.15,

        // Best in Advocacy
        ("best_advocacy", "relevance_alignment") => 0.30,
        ("best_advocacy", "content_substance") => 0.25,
        ("best_advocacy", "clarity_organization") => 0.25,
        ("best_advocacy", "delivery_impact") => 0.20,

        // Best in Ramp
        ("best_in_ramp", "poise_posture") => 0.30,
        ("best_in_ramp", "confidence_stage") => 0.30,
        ("best_in_ramp", "runway_technique") => 0.25,
        ("best_in_ramp", "overall_impact") => 0.15,

        _ => 0.0,
    }
}

pub fn compute_segment_score(segment_id: &str, entries: &[CriterionEntry]) -> f64 {
    let mut total_score = 0.0;
    for entry in entries {
        let weight = get_criterion_weight(segment_id, &entry.criterion_id);
        total_score += (entry.score as f64) * weight;
    }
    total_score
}

pub fn compute_avg_segment_score(judge_scores: &[f64]) -> f64 {
    if judge_scores.is_empty() {
        return 0.0;
    }
    let sum: f64 = judge_scores.iter().sum();
    sum / (judge_scores.len() as f64)
}

pub fn compute_preliminary_score(segment_ranks: &[f64]) -> f64 {
    if segment_ranks.is_empty() {
        return 0.0;
    }
    // Preliminary Score = sum of (Rank * 0.20) for each of the 5 segments
    let sum: f64 = segment_ranks.iter().sum();
    sum * 0.20
}

pub fn compute_final_score(prelim: f64, final_qa: f64) -> f64 {
    (prelim * 0.50) + (final_qa * 0.50)
}

pub fn get_segment_criteria_ids(segment_id: &str) -> Vec<&'static str> {
    match segment_id {
        "production_number" => vec!["stage_presence", "energy", "audience_engagement", "overall_appeal"],
        "school_uniform" => vec!["neatness", "confidence_bearing", "advocacy", "overall_impact"],
        "professional_attire" => vec!["elegance_professionalism", "suitability", "confidence_stage", "overall_impact"],
        "modern_barong" => vec!["elegance_poise", "suitability_creativity", "confidence_stage", "overall_impact"],
        "preliminary_qa" | "final_qa" | "tie_breaking_qa" => vec!["content_substance", "clarity_organization", "confidence_delivery", "relevance"],
        "best_advocacy" => vec!["relevance_alignment", "content_substance", "clarity_organization", "delivery_impact"],
        "best_in_ramp" => vec!["poise_posture", "confidence_stage", "runway_technique", "overall_impact"],
        _ => vec![],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::server::score_routes::CriterionEntry;

    #[test]
    fn test_fixture_rs_1() {
        let entries = vec![
            CriterionEntry { criterion_id: "relevance_alignment".to_string(), score: 90 }, // weight 0.30
            CriterionEntry { criterion_id: "content_substance".to_string(), score: 80 },   // weight 0.25
            CriterionEntry { criterion_id: "clarity_organization".to_string(), score: 70 },// weight 0.25
            CriterionEntry { criterion_id: "delivery_impact".to_string(), score: 100 },    // weight 0.20
        ];
        let result = compute_segment_score("best_advocacy", &entries);
        assert_eq!(result, 84.5);
    }

    #[test]
    fn test_fixture_rs_2() {
        let entries = vec![
            CriterionEntry { criterion_id: "relevance_alignment".to_string(), score: 100 },
            CriterionEntry { criterion_id: "content_substance".to_string(), score: 100 },
            CriterionEntry { criterion_id: "clarity_organization".to_string(), score: 100 },
            CriterionEntry { criterion_id: "delivery_impact".to_string(), score: 100 },
        ];
        let result = compute_segment_score("best_advocacy", &entries);
        assert_eq!(result, 100.0);
    }

    #[test]
    fn test_fixture_rs_3() {
        let entries = vec![
            CriterionEntry { criterion_id: "relevance_alignment".to_string(), score: 1 },
            CriterionEntry { criterion_id: "content_substance".to_string(), score: 1 },
            CriterionEntry { criterion_id: "clarity_organization".to_string(), score: 1 },
            CriterionEntry { criterion_id: "delivery_impact".to_string(), score: 1 },
        ];
        let result = compute_segment_score("best_advocacy", &entries);
        assert_eq!(result, 1.0);
    }

    #[test]
    fn test_fixture_pc_1() {
        let ranks = vec![1.0, 2.0, 1.0, 3.0, 2.0];
        let result = compute_preliminary_score(&ranks);
        assert_eq!(result, 1.8);
    }

    #[test]
    fn test_fixture_cs_1() {
        let result = compute_final_score(1.8, 1.0);
        assert_eq!(result, 1.4);
    }

    #[test]
    fn test_fixture_ma_1() {
        let scores = vec![88.0, 92.0, 79.5];
        let result = compute_avg_segment_score(&scores);
        assert_eq!(result, 86.5);
    }
}
