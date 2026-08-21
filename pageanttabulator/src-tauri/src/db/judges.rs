use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Judge {
    pub id: String,
    pub name: Option<String>,
    pub is_active: bool,
    pub last_seen: Option<String>,
}

pub fn get_all(conn: &Connection) -> Result<Vec<Judge>> {
    let mut stmt = conn.prepare("SELECT * FROM judges ORDER BY id ASC")?;
    let iter = stmt.query_map([], |row| {
        Ok(Judge {
            id: row.get("id")?,
            name: row.get("name")?,
            is_active: row.get("is_active")?,
            last_seen: row.get("last_seen")?,
        })
    })?;

    let mut judges = Vec::new();
    for j in iter {
        judges.push(j?);
    }
    Ok(judges)
}

pub fn upsert(conn: &Connection, j: &Judge) -> Result<()> {
    conn.execute(
        "INSERT INTO judges (id, name, is_active, last_seen) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, is_active=excluded.is_active, last_seen=excluded.last_seen",
        params![j.id, j.name, j.is_active, j.last_seen],
    )?;
    Ok(())
}

pub fn set_active(conn: &Connection, id: &str, is_active: bool, last_seen: Option<&str>) -> Result<()> {
    conn.execute(
        "UPDATE judges SET is_active = ?1, last_seen = ?2 WHERE id = ?3",
        params![is_active, last_seen, id],
    )?;
    Ok(())
}
