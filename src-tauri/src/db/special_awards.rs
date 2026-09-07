use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SpecialAward {
    pub award_id: String,
    pub winner_male_id: Option<String>,
    pub winner_female_id: Option<String>,
    pub is_auto_computed: bool,
    pub notes: Option<String>,
    pub assigned_at: Option<String>,
}

pub fn insert_or_update(conn: &Connection, award: &SpecialAward) -> Result<()> {
    conn.execute(
        "INSERT INTO special_awards (award_id, winner_male_id, winner_female_id, is_auto_computed, notes, assigned_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(award_id) DO UPDATE SET
         winner_male_id = excluded.winner_male_id,
         winner_female_id = excluded.winner_female_id,
         is_auto_computed = excluded.is_auto_computed,
         notes = excluded.notes,
         assigned_at = excluded.assigned_at",
        params![
            award.award_id,
            award.winner_male_id,
            award.winner_female_id,
            award.is_auto_computed,
            award.notes,
            award.assigned_at
        ],
    )?;
    Ok(())
}

pub fn get_all(conn: &Connection) -> Result<Vec<SpecialAward>> {
    let mut stmt = conn.prepare("SELECT * FROM special_awards")?;
    let award_iter = stmt.query_map([], |row| {
        Ok(SpecialAward {
            award_id: row.get("award_id")?,
            winner_male_id: row.get("winner_male_id")?,
            winner_female_id: row.get("winner_female_id")?,
            is_auto_computed: row.get("is_auto_computed")?,
            notes: row.get("notes")?,
            assigned_at: row.get("assigned_at")?,
        })
    })?;

    let mut awards = Vec::new();
    for award in award_iter {
        awards.push(award?);
    }
    Ok(awards)
}
