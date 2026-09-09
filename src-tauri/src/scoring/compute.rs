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

pub fn compute_preliminary_score(preliminary_qa: f64) -> f64 {
    // The Preliminary Score used to select the Top 3 is derived exclusively from the Preliminary Q&A segment.
    preliminary_qa
}

pub fn compute_final_score(prelim: f64, final_qa: f64) -> f64 {
    (prelim * 0.50) + (final_qa * 0.50)
}
