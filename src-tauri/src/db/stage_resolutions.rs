use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StageResolution {
    pub candidate_id: String,
    pub stage: String,
    pub resolution: String,
    pub created_at: String,
}

pub fn insert(conn: &Connection, resolution: &StageResolution) -> Result<()> {
    conn.execute(
        "INSERT INTO stage_resolutions (candidate_id, stage, resolution, created_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(candidate_id, stage) DO UPDATE SET 
            resolution=excluded.resolution,
            created_at=excluded.created_at",
        params![
            resolution.candidate_id, resolution.stage, resolution.resolution, resolution.created_at
        ],
    )?;
    Ok(())
}

pub fn get_by_stage(conn: &Connection, stage: &str) -> Result<Vec<StageResolution>> {
    let mut stmt = conn.prepare("SELECT * FROM stage_resolutions WHERE stage = ?1")?;
    let iter = stmt.query_map([stage], |row| {
        Ok(StageResolution {
            candidate_id: row.get("candidate_id")?,
            stage: row.get("stage")?,
            resolution: row.get("resolution")?,
            created_at: row.get("created_at")?,
        })
    })?;

    let mut resolutions = Vec::new();
    for r in iter {
        resolutions.push(r?);
    }
    Ok(resolutions)
}
