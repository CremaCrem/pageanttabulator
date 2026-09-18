use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Score {
    pub id: String,
    pub judge_id: String,
    pub judge_name: Option<String>,
    pub candidate_id: String,
    pub segment_id: String,
    pub criteria_json: String, // Stored as JSON string
    pub computed_score: f64,
    pub submitted_at: String,
}

pub fn insert(conn: &Connection, s: &Score) -> Result<()> {
    conn.execute(
        "INSERT INTO scores (id, judge_id, judge_name, candidate_id, segment_id, criteria_json, computed_score, submitted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![s.id, s.judge_id, s.judge_name, s.candidate_id, s.segment_id, s.criteria_json, s.computed_score, s.submitted_at],
    )?;
    Ok(())
}

pub fn get_by_judge(conn: &Connection, judge_id: &str) -> Result<Vec<Score>> {
    let mut stmt = conn.prepare("SELECT * FROM scores WHERE judge_id = ?1")?;
    let iter = stmt.query_map(params![judge_id], |row| {
        Ok(Score {
            id: row.get("id")?,
            judge_id: row.get("judge_id")?,
            judge_name: row.get("judge_name")?,
            candidate_id: row.get("candidate_id")?,
            segment_id: row.get("segment_id")?,
            criteria_json: row.get("criteria_json")?,
            computed_score: row.get("computed_score")?,
            submitted_at: row.get("submitted_at")?,
        })
    })?;

    let mut scores = Vec::new();
    for s in iter {
        scores.push(s?);
    }
    Ok(scores)
}

pub fn get_by_segment(conn: &Connection, segment_id: &str) -> Result<Vec<Score>> {
    let mut stmt = conn.prepare("SELECT * FROM scores WHERE segment_id = ?1")?;
    let iter = stmt.query_map(params![segment_id], |row| {
        Ok(Score {
            id: row.get("id")?,
            judge_id: row.get("judge_id")?,
            judge_name: row.get("judge_name")?,
            candidate_id: row.get("candidate_id")?,
            segment_id: row.get("segment_id")?,
            criteria_json: row.get("criteria_json")?,
            computed_score: row.get("computed_score")?,
            submitted_at: row.get("submitted_at")?,
        })
    })?;

    let mut scores = Vec::new();
    for s in iter {
        scores.push(s?);
    }
    Ok(scores)
}

pub fn count_by_judge(conn: &Connection, judge_id: &str) -> Result<i32> {
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM scores WHERE judge_id = ?1")?;
    let count: i32 = stmt.query_row(params![judge_id], |row| row.get(0))?;
    Ok(count)
}

pub fn get_all(conn: &Connection) -> Result<Vec<Score>> {
    let mut stmt = conn.prepare("SELECT * FROM scores")?;
    let iter = stmt.query_map([], |row| {
        Ok(Score {
            id: row.get("id")?,
            judge_id: row.get("judge_id")?,
            judge_name: row.get("judge_name")?,
            candidate_id: row.get("candidate_id")?,
            segment_id: row.get("segment_id")?,
            criteria_json: row.get("criteria_json")?,
            computed_score: row.get("computed_score")?,
            submitted_at: row.get("submitted_at")?,
        })
    })?;

    let mut scores = Vec::new();
    for s in iter {
        scores.push(s?);
    }
    Ok(scores)
}

pub fn get_one(
    conn: &Connection,
    judge_id: &str,
    candidate_id: &str,
    segment_id: &str,
) -> Result<Option<Score>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM scores WHERE judge_id = ?1 AND candidate_id = ?2 AND segment_id = ?3",
    )?;
    let mut iter = stmt.query_map(params![judge_id, candidate_id, segment_id], |row| {
        Ok(Score {
            id: row.get("id")?,
            judge_id: row.get("judge_id")?,
            judge_name: row.get("judge_name")?,
            candidate_id: row.get("candidate_id")?,
            segment_id: row.get("segment_id")?,
            criteria_json: row.get("criteria_json")?,
            computed_score: row.get("computed_score")?,
            submitted_at: row.get("submitted_at")?,
        })
    })?;
    match iter.next() {
        Some(s) => Ok(Some(s?)),
        None => Ok(None),
    }
}

/// Admin-only score correction. Rewrites an existing row in place, keeping its id so
/// downstream math sees one score per judge/candidate/segment, exactly as before.
/// Never call this from a judge-facing path — see `docs/scoped/scoring-logic.md` §2.1.
pub fn update_criteria(
    conn: &Connection,
    score_id: &str,
    criteria_json: &str,
    computed_score: f64,
    corrected_at: &str,
) -> Result<usize> {
    conn.execute(
        "UPDATE scores SET criteria_json = ?1, computed_score = ?2, submitted_at = ?3 WHERE id = ?4",
        params![criteria_json, computed_score, corrected_at, score_id],
    )
}
