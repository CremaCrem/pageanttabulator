use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub id: String,
    pub candidate_number: String,
    pub full_name: String,
    pub nickname: Option<String>,
    pub gender: String,
    pub department: String,
    pub photo_path: Option<String>,
    pub is_eligible: bool,
    pub disqualification_note: Option<String>,
    pub created_at: String,
}

pub fn get_all(conn: &Connection) -> Result<Vec<Candidate>> {
    let mut stmt = conn.prepare("SELECT * FROM candidates ORDER BY candidate_number ASC")?;
    let candidate_iter = stmt.query_map([], |row| {
        Ok(Candidate {
            id: row.get("id")?,
            candidate_number: row.get("candidate_number")?,
            full_name: row.get("full_name")?,
            nickname: row.get("nickname")?,
            gender: row.get("gender")?,
            department: row.get("department")?,
            photo_path: row.get("photo_path")?,
            is_eligible: row.get("is_eligible")?,
            disqualification_note: row.get("disqualification_note")?,
            created_at: row.get("created_at")?,
        })
    })?;

    let mut candidates = Vec::new();
    for candidate in candidate_iter {
        candidates.push(candidate?);
    }
    Ok(candidates)
}

pub fn insert(conn: &Connection, c: &Candidate) -> Result<()> {
    conn.execute(
        "INSERT INTO candidates (
            id, candidate_number, full_name, nickname, gender, department, photo_path, is_eligible, disqualification_note, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            c.id, c.candidate_number, c.full_name, c.nickname, c.gender, c.department, c.photo_path, c.is_eligible, c.disqualification_note, c.created_at
        ],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, c: &Candidate) -> Result<()> {
    conn.execute(
        "UPDATE candidates SET 
            candidate_number = ?1, full_name = ?2, nickname = ?3, gender = ?4, department = ?5, photo_path = ?6
        WHERE id = ?7",
        params![
            c.candidate_number, c.full_name, c.nickname, c.gender, c.department, c.photo_path, c.id
        ],
    )?;
    Ok(())
}

pub fn disqualify(conn: &Connection, id: &str, note: Option<&str>) -> Result<()> {
    conn.execute(
        "UPDATE candidates SET is_eligible = 0, disqualification_note = ?1 WHERE id = ?2",
        params![note, id],
    )?;
    Ok(())
}
