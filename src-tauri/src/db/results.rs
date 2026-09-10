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
    pub is_top3: bool,
    pub computed_at: String,
}

/// Inserts or updates a result row. For overall results, segment_id should be
/// Some("") (empty string) instead of None, so the UNIQUE constraint works
/// correctly with ON CONFLICT.
pub fn insert(conn: &Connection, res: &CandidateResult) -> Result<()> {
    // Normalize: treat None as empty string for segment_id so UNIQUE works
    let segment_id = res.segment_id.as_deref().unwrap_or("");
    conn.execute(
        "INSERT INTO results (candidate_id, segment_id, preliminary_score, final_qa_score, final_score, rank, is_top3, computed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(candidate_id, segment_id) DO UPDATE SET 
            preliminary_score=excluded.preliminary_score,
            final_qa_score=excluded.final_qa_score,
            final_score=excluded.final_score,
            rank=excluded.rank,
            is_top3=excluded.is_top3,
            computed_at=excluded.computed_at",
        params![
            res.candidate_id, segment_id, res.preliminary_score, res.final_qa_score, res.final_score, res.rank, res.is_top3, res.computed_at
        ],
    )?;
    Ok(())
}

/// Fetches overall results (segment_id IS NULL or empty string).
/// Sorted by preliminary_score ASC because lower rank-sum is better in Borda count.
pub fn get_overall_results(conn: &Connection) -> Result<Vec<CandidateResult>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM results WHERE (segment_id IS NULL OR segment_id = '') ORDER BY rank ASC, preliminary_score ASC"
    )?;
    let iter = stmt.query_map([], |row| {
        Ok(CandidateResult {
            candidate_id: row.get("candidate_id")?,
            segment_id: row.get("segment_id")?,
            preliminary_score: row.get("preliminary_score")?,
            final_qa_score: row.get("final_qa_score")?,
            final_score: row.get("final_score")?,
            rank: row.get("rank")?,
            is_top3: row.get("is_top3")?,
            computed_at: row.get("computed_at")?,
        })
    })?;

    let mut results = Vec::new();
    for r in iter {
        results.push(r?);
    }
    Ok(results)
}

pub fn update_top3(conn: &Connection, candidate_id: &str, is_top3: bool) -> Result<()> {
    // Update the overall result (where segment_id is NULL or empty string)
    conn.execute(
        "UPDATE results SET is_top3 = ?1 WHERE candidate_id = ?2 AND (segment_id IS NULL OR segment_id = '')",
        params![is_top3, candidate_id],
    )?;
    Ok(())
}

/// One-time cleanup: removes duplicate overall-result rows caused by the
/// NULL-uniqueness bug. Keeps only the most recent row per candidate (by rowid).
/// Also migrates any remaining NULL segment_id rows to empty string.
pub fn cleanup_duplicate_overall_results(conn: &Connection) -> Result<usize> {
    // Step 1: Delete duplicates — keep only the row with the highest rowid per candidate
    let deleted = conn.execute(
        "DELETE FROM results WHERE (segment_id IS NULL OR segment_id = '') AND rowid NOT IN (
            SELECT MAX(rowid) FROM results WHERE (segment_id IS NULL OR segment_id = '') GROUP BY candidate_id
        )",
        [],
    )?;

    // Step 2: Migrate remaining NULL segment_id rows to empty string
    conn.execute(
        "UPDATE results SET segment_id = '' WHERE segment_id IS NULL",
        [],
    )?;

    Ok(deleted)
}
