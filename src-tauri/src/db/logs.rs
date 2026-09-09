use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SystemLog {
    pub id: String,
    pub level: String,  // "info", "warn", "error"
    pub source: String, // "ws", "api", "auth", "db"
    pub message: String,
    pub details: Option<String>,
    pub created_at: String,
}

pub fn insert(conn: &Connection, log: &SystemLog) -> Result<()> {
    conn.execute(
        "INSERT INTO system_logs (id, level, source, message, details, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            log.id,
            log.level,
            log.source,
            log.message,
            log.details,
            log.created_at
        ],
    )?;
    Ok(())
}

pub fn get_all(conn: &Connection) -> Result<Vec<SystemLog>> {
    let mut stmt = conn.prepare("SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 100")?;
    let iter = stmt.query_map([], |row| {
        Ok(SystemLog {
            id: row.get("id")?,
            level: row.get("level")?,
            source: row.get("source")?,
            message: row.get("message")?,
            details: row.get("details")?,
            created_at: row.get("created_at")?,
        })
    })?;

    let mut logs = Vec::new();
    for l in iter {
        logs.push(l?);
    }
    Ok(logs)
}

pub fn clear_all(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM system_logs", [])?;
    Ok(())
}
