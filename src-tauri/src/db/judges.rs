use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Judge {
    pub id: String,
    pub name: Option<String>,
    pub photo_path: Option<String>,
    pub password: Option<String>,
    pub is_active: bool,
    pub session_token: Option<String>,
    pub last_seen: Option<String>,
}

pub fn get_all(conn: &Connection) -> Result<Vec<Judge>> {
    let mut stmt = conn.prepare("SELECT * FROM judges ORDER BY id ASC")?;
    let iter = stmt.query_map([], |row| {
        Ok(Judge {
            id: row.get("id")?,
            name: row.get("name")?,
            photo_path: row.get("photo_path")?,
            password: row.get("password")?,
            is_active: row.get("is_active")?,
            session_token: row.get("session_token")?,
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
        "INSERT INTO judges (id, name, photo_path, password, is_active, session_token, last_seen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, photo_path=excluded.photo_path, password=excluded.password, is_active=excluded.is_active, session_token=excluded.session_token, last_seen=excluded.last_seen",
        params![j.id, j.name, j.photo_path, j.password, j.is_active, j.session_token, j.last_seen],
    )?;
    Ok(())
}

pub fn set_active(
    conn: &Connection,
    id: &str,
    is_active: bool,
    last_seen: Option<&str>,
) -> Result<()> {
    conn.execute(
        "UPDATE judges SET is_active = ?1, last_seen = ?2 WHERE id = ?3",
        params![is_active, last_seen, id],
    )?;
    Ok(())
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Judge>> {
    let mut stmt = conn.prepare("SELECT * FROM judges WHERE id = ?1")?;
    let mut iter = stmt.query_map(params![id], |row| {
        Ok(Judge {
            id: row.get("id")?,
            name: row.get("name")?,
            photo_path: row.get("photo_path")?,
            password: row.get("password")?,
            is_active: row.get("is_active")?,
            session_token: row.get("session_token")?,
            last_seen: row.get("last_seen")?,
        })
    })?;

    if let Some(j) = iter.next() {
        Ok(Some(j?))
    } else {
        Ok(None)
    }
}

pub fn update_judge_profile(
    conn: &Connection,
    id: &str,
    name: Option<&str>,
    photo_path: Option<&str>,
    password: Option<&str>,
) -> Result<()> {
    conn.execute(
        "UPDATE judges SET name = ?1, photo_path = ?2, password = ?3 WHERE id = ?4",
        params![name, photo_path, password, id],
    )?;
    Ok(())
}
