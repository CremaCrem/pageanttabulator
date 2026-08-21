use rusqlite::{params, Connection, Result, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RoundState {
    pub segment_id: String,
    pub status: String, // 'not_started' | 'open' | 'locked'
    pub opened_at: Option<String>,
    pub locked_at: Option<String>,
}

pub fn get_all(conn: &Connection) -> Result<Vec<RoundState>> {
    let mut stmt = conn.prepare("SELECT * FROM rounds")?;
    let iter = stmt.query_map([], |row| {
        Ok(RoundState {
            segment_id: row.get("segment_id")?,
            status: row.get("status")?,
            opened_at: row.get("opened_at")?,
            locked_at: row.get("locked_at")?,
        })
    })?;

    let mut rounds = Vec::new();
    for r in iter {
        rounds.push(r?);
    }
    Ok(rounds)
}

pub fn get_status(conn: &Connection, segment_id: &str) -> Result<Option<RoundState>> {
    let mut stmt = conn.prepare("SELECT * FROM rounds WHERE segment_id = ?1")?;
    stmt.query_row(params![segment_id], |row| {
        Ok(RoundState {
            segment_id: row.get("segment_id")?,
            status: row.get("status")?,
            opened_at: row.get("opened_at")?,
            locked_at: row.get("locked_at")?,
        })
    }).optional()
}

pub fn upsert(conn: &Connection, r: &RoundState) -> Result<()> {
    conn.execute(
        "INSERT INTO rounds (segment_id, status, opened_at, locked_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(segment_id) DO UPDATE SET status=excluded.status, opened_at=excluded.opened_at, locked_at=excluded.locked_at",
        params![r.segment_id, r.status, r.opened_at, r.locked_at],
    )?;
    Ok(())
}
