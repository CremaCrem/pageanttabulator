use rusqlite::{params, Connection, OptionalExtension, Result};
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
    })
    .optional()
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

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PastEvent {
    pub id: String,
    pub name: String,
    pub subtitle: Option<String>,
    pub event_date: Option<String>,
    pub winners_json: String,
    pub created_at: String,
}

pub fn save_past_event(conn: &Connection, event: &PastEvent) -> Result<()> {
    conn.execute(
        "INSERT INTO past_events (id, name, subtitle, event_date, winners_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            event.id,
            event.name,
            event.subtitle,
            event.event_date,
            event.winners_json,
            event.created_at
        ],
    )?;
    Ok(())
}

pub fn get_past_events(conn: &Connection) -> Result<Vec<PastEvent>> {
    let mut stmt = conn.prepare("SELECT * FROM past_events ORDER BY created_at DESC")?;
    let iter = stmt.query_map([], |row| {
        Ok(PastEvent {
            id: row.get("id")?,
            name: row.get("name")?,
            subtitle: row.get("subtitle")?,
            event_date: row.get("event_date")?,
            winners_json: row.get("winners_json")?,
            created_at: row.get("created_at")?,
        })
    })?;

    let mut events = Vec::new();
    for e in iter {
        events.push(e?);
    }
    Ok(events)
}

pub fn reset_active_event(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM scores", [])?;
    conn.execute("DELETE FROM candidates", [])?;
    conn.execute("DELETE FROM rounds", [])?;
    conn.execute("DELETE FROM results", [])?;
    conn.execute("DELETE FROM special_awards", [])?;
    conn.execute("UPDATE judges SET is_active = 0, session_token = NULL", [])?;
    // We don't delete event_config, but we probably should leave it or let admin update it manually.
    Ok(())
}
