use rusqlite::{params, Connection, Result, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct EventConfig {
    pub id: i64,
    pub name: String,
    pub subtitle: Option<String>,
    pub event_date: Option<String>,
    pub venue: Option<String>,
    pub judge_count: i64,
    pub admin_pin: String,
    pub created_at: String,
}

pub fn get(conn: &Connection) -> Result<Option<EventConfig>> {
    let mut stmt = conn.prepare("SELECT * FROM event_config WHERE id = 1")?;
    stmt.query_row([], |row| {
        Ok(EventConfig {
            id: row.get("id")?,
            name: row.get("name")?,
            subtitle: row.get("subtitle")?,
            event_date: row.get("event_date")?,
            venue: row.get("venue")?,
            judge_count: row.get("judge_count")?,
            admin_pin: row.get("admin_pin")?,
            created_at: row.get("created_at")?,
        })
    }).optional()
}

pub fn upsert(conn: &Connection, config: &EventConfig) -> Result<()> {
    conn.execute(
        "INSERT INTO event_config (id, name, subtitle, event_date, venue, judge_count, admin_pin, created_at)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET 
            name=excluded.name, 
            subtitle=excluded.subtitle, 
            event_date=excluded.event_date, 
            venue=excluded.venue, 
            judge_count=excluded.judge_count, 
            admin_pin=excluded.admin_pin",
        params![
            config.name, config.subtitle, config.event_date, config.venue, config.judge_count, config.admin_pin, config.created_at
        ],
    )?;
    Ok(())
}
