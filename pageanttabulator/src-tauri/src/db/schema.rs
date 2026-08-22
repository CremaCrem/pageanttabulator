use rusqlite::Connection;
use std::path::Path;
use tauri::Manager;

pub fn init_db(app_handle: &tauri::AppHandle) -> Result<Connection, rusqlite::Error> {
    let app_dir = app_handle.path().app_data_dir().expect("failed to get app data dir");
    std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");
    let db_path = app_dir.join("pageant_data.db");
    init_db_with_path(&db_path)
}

pub fn init_db_with_path(db_path: &Path) -> Result<Connection, rusqlite::Error> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let conn = Connection::open(db_path)?;
    
    // Event configuration (one row)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS event_config (
            id          INTEGER PRIMARY KEY DEFAULT 1,
            name        TEXT NOT NULL,
            subtitle    TEXT,
            event_date  TEXT,
            venue       TEXT,
            judge_count INTEGER NOT NULL DEFAULT 5,
            admin_pin   TEXT NOT NULL,
            created_at  TEXT NOT NULL
        )",
        [],
    )?;

    // Candidates
    conn.execute(
        "CREATE TABLE IF NOT EXISTS candidates (
            id                    TEXT PRIMARY KEY,
            candidate_number      TEXT NOT NULL UNIQUE,
            full_name             TEXT NOT NULL,
            nickname              TEXT,
            gender                TEXT NOT NULL CHECK(gender IN ('male', 'female')),
            department            TEXT NOT NULL,
            photo_path            TEXT,
            is_eligible           INTEGER NOT NULL DEFAULT 1,
            disqualification_note TEXT,
            created_at            TEXT NOT NULL
        )",
        [],
    )?;

    // Judge slots
    conn.execute(
        "CREATE TABLE IF NOT EXISTS judges (
            id          TEXT PRIMARY KEY,
            name        TEXT,
            is_active   INTEGER NOT NULL DEFAULT 0,
            last_seen   TEXT
        )",
        [],
    )?;

    // Segment/round state
    conn.execute(
        "CREATE TABLE IF NOT EXISTS rounds (
            segment_id  TEXT PRIMARY KEY,
            status      TEXT NOT NULL DEFAULT 'not_started',
            opened_at   TEXT,
            locked_at   TEXT
        )",
        [],
    )?;

    // Scores
    conn.execute(
        "CREATE TABLE IF NOT EXISTS scores (
            id              TEXT PRIMARY KEY,
            judge_id        TEXT NOT NULL,
            candidate_id    TEXT NOT NULL,
            segment_id      TEXT NOT NULL,
            criteria_json   TEXT NOT NULL,
            computed_score  REAL NOT NULL,
            submitted_at    TEXT NOT NULL,
            UNIQUE(judge_id, candidate_id, segment_id)
        )",
        [],
    )?;

    // Computed results
    conn.execute(
        "CREATE TABLE IF NOT EXISTS results (
            candidate_id        TEXT NOT NULL,
            segment_id          TEXT,
            preliminary_score   REAL,
            final_qa_score      REAL,
            final_score         REAL,
            rank                INTEGER,
            is_top5             INTEGER NOT NULL DEFAULT 0,
            computed_at         TEXT NOT NULL,
            PRIMARY KEY (candidate_id, segment_id)
        )",
        [],
    )?;

    // Special awards
    conn.execute(
        "CREATE TABLE IF NOT EXISTS special_awards (
            award_id          TEXT PRIMARY KEY,
            winner_male_id    TEXT,
            winner_female_id  TEXT,
            is_auto_computed  INTEGER NOT NULL DEFAULT 0,
            notes             TEXT,
            assigned_at       TEXT
        )",
        [],
    )?;

    Ok(conn)
}
