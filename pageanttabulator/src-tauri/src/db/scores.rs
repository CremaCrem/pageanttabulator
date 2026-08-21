use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Score {
    pub id: String,
    pub judge_id: String,
    pub candidate_id: String,
    pub segment_id: String,
    pub criteria_json: String, // Stored as JSON string
    pub computed_score: f64,
    pub submitted_at: String,
}

pub fn insert(conn: &Connection, s: &Score) -> Result<()> {
    conn.execute(
        "INSERT INTO scores (id, judge_id, candidate_id, segment_id, criteria_json, computed_score, submitted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![s.id, s.judge_id, s.candidate_id, s.segment_id, s.criteria_json, s.computed_score, s.submitted_at],
    )?;
    Ok(())
}

pub fn get_by_judge(conn: &Connection, judge_id: &str) -> Result<Vec<Score>> {
    let mut stmt = conn.prepare("SELECT * FROM scores WHERE judge_id = ?1")?;
    let iter = stmt.query_map(params![judge_id], |row| {
        Ok(Score {
            id: row.get("id")?,
            judge_id: row.get("judge_id")?,
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
