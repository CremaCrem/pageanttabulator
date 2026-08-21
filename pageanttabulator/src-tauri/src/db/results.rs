use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CandidateResult {
    pub candidate_id: String,
    pub segment_id: Option<String>,
    pub preliminary_score: Option<f64>,
    pub final_qa_score: Option<f64>,
    pub final_score: Option<f64>,
    pub rank: Option<i64>,
    pub is_top5: bool,
    pub computed_at: String,
}

pub fn insert(conn: &Connection, res: &CandidateResult) -> Result<()> {
    conn.execute(
        "INSERT INTO results (candidate_id, segment_id, preliminary_score, final_qa_score, final_score, rank, is_top5, computed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(candidate_id, segment_id) DO UPDATE SET 
            preliminary_score=excluded.preliminary_score,
            final_qa_score=excluded.final_qa_score,
            final_score=excluded.final_score,
            rank=excluded.rank,
            is_top5=excluded.is_top5,
            computed_at=excluded.computed_at",
        params![
            res.candidate_id, res.segment_id, res.preliminary_score, res.final_qa_score, res.final_score, res.rank, res.is_top5, res.computed_at
        ],
    )?;
    Ok(())
}

pub fn get_overall_results(conn: &Connection) -> Result<Vec<CandidateResult>> {
    let mut stmt = conn.prepare("SELECT * FROM results WHERE segment_id IS NULL ORDER BY final_score DESC, preliminary_score DESC")?;
    let iter = stmt.query_map([], |row| {
        Ok(CandidateResult {
            candidate_id: row.get("candidate_id")?,
            segment_id: row.get("segment_id")?,
            preliminary_score: row.get("preliminary_score")?,
            final_qa_score: row.get("final_qa_score")?,
            final_score: row.get("final_score")?,
            rank: row.get("rank")?,
            is_top5: row.get("is_top5")?,
            computed_at: row.get("computed_at")?,
        })
    })?;

    let mut results = Vec::new();
    for r in iter {
        results.push(r?);
    }
    Ok(results)
}

pub fn update_top5(conn: &Connection, candidate_id: &str, is_top5: bool) -> Result<()> {
    // Update the overall result (where segment_id is NULL)
    conn.execute(
        "UPDATE results SET is_top5 = ?1 WHERE candidate_id = ?2 AND segment_id IS NULL",
        params![is_top5, candidate_id],
    )?;
    Ok(())
}
