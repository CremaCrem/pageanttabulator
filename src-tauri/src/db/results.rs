use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CandidateResult {
    pub candidate_id: String,
    pub segment_id: Option<String>,
    pub preliminary_score: Option<f64>,
    pub preliminary_status: String, // 'advancing', 'excluded', 'pending_override', 'pending'
    pub final_qa_score: Option<f64>,
    pub final_score: Option<f64>,
    pub rank: Option<i64>,
    pub computed_at: String,
}

pub fn insert(conn: &Connection, res: &CandidateResult) -> Result<()> {
    let segment_id = res.segment_id.as_deref().unwrap_or("");
    conn.execute(
        "INSERT INTO results (candidate_id, segment_id, preliminary_score, preliminary_status, final_qa_score, final_score, rank, computed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(candidate_id, segment_id) DO UPDATE SET 
            preliminary_score=excluded.preliminary_score,
            preliminary_status=excluded.preliminary_status,
            final_qa_score=excluded.final_qa_score,
            final_score=excluded.final_score,
            rank=excluded.rank,
            computed_at=excluded.computed_at",
        params![
            res.candidate_id, segment_id, res.preliminary_score, res.preliminary_status, res.final_qa_score, res.final_score, res.rank, res.computed_at
        ],
    )?;
    Ok(())
}

pub fn get_overall_results(conn: &Connection) -> Result<Vec<CandidateResult>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM results WHERE (segment_id IS NULL OR segment_id = '') ORDER BY rank ASC, preliminary_score ASC"
    )?;
    let iter = stmt.query_map([], |row| {
        Ok(CandidateResult {
            candidate_id: row.get("candidate_id")?,
            segment_id: row.get("segment_id")?,
            preliminary_score: row.get("preliminary_score")?,
            preliminary_status: row.get("preliminary_status")?,
            final_qa_score: row.get("final_qa_score")?,
            final_score: row.get("final_score")?,
            rank: row.get("rank")?,
            computed_at: row.get("computed_at")?,
        })
    })?;

    let mut results = Vec::new();
    for r in iter {
        results.push(r?);
    }
    Ok(results)
}

