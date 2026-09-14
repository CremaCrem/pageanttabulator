use rusqlite::Connection;
use std::path::Path;
use tauri::Manager;

pub fn init_db(app_handle: &tauri::AppHandle) -> Result<Connection, rusqlite::Error> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
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
            candidate_number      TEXT NOT NULL,
            full_name             TEXT NOT NULL,
            nickname              TEXT,
            gender                TEXT NOT NULL CHECK(gender IN ('male', 'female')),
            department            TEXT NOT NULL,
            photo_path            TEXT,
            is_eligible           INTEGER NOT NULL DEFAULT 1,
            is_in_tiebreak        INTEGER NOT NULL DEFAULT 0,
            disqualification_note TEXT,
            created_at            TEXT NOT NULL,
            UNIQUE(candidate_number, gender)
        )",
        [],
    )?;

    // Judge slots
    conn.execute(
        "CREATE TABLE IF NOT EXISTS judges (
            id            TEXT PRIMARY KEY,
            name          TEXT,
            photo_path    TEXT,
            password      TEXT,
            is_active     INTEGER NOT NULL DEFAULT 0,
            session_token TEXT,
            last_seen     TEXT
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

    // Check if we need to reset the results table
    let results_sql: String = conn.query_row(
        "SELECT sql FROM sqlite_schema WHERE type='table' AND name='results'",
        [],
        |row| row.get(0),
    ).unwrap_or_default();

    if !results_sql.contains("preliminary_status") {
        let _ = conn.execute("DROP TABLE IF EXISTS results", []);
    }

    // Computed results
    conn.execute(
        "CREATE TABLE IF NOT EXISTS results (
            candidate_id        TEXT NOT NULL,
            segment_id          TEXT,
            preliminary_score   REAL,
            preliminary_status  TEXT NOT NULL DEFAULT 'pending',
            final_qa_score      REAL,
            final_score         REAL,
            rank                INTEGER,
            computed_at         TEXT NOT NULL,
            UNIQUE(candidate_id, segment_id)
        )",
        [],
    )?;

    // Fix NULL segment_ids for unique constraints
    // First, delete duplicates keeping only the most recent row per candidate
    let _ = conn.execute(
        "DELETE FROM results WHERE (segment_id IS NULL OR segment_id = '') AND rowid NOT IN (
            SELECT MAX(rowid) FROM results WHERE (segment_id IS NULL OR segment_id = '') GROUP BY candidate_id
        )",
        [],
    );
    // Then normalize remaining NULLs to ''
    let _ = conn.execute("UPDATE results SET segment_id = '' WHERE segment_id IS NULL", []);

    // Admin Overrides / Stage Resolutions
    conn.execute(
        "CREATE TABLE IF NOT EXISTS stage_resolutions (
            candidate_id TEXT NOT NULL,
            stage TEXT NOT NULL,
            resolution TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (candidate_id, stage)
        )",
        [],
    )?;

    // Quick migration for existing databases
    let candidates_sql: String = conn.query_row(
        "SELECT sql FROM sqlite_schema WHERE type='table' AND name='candidates'",
        [],
        |row| row.get(0),
    ).unwrap_or_default();

    if candidates_sql.contains("UNIQUE") && !candidates_sql.contains("UNIQUE(candidate_number, gender)") {
        if let Err(e) = conn.execute_batch(
            "BEGIN TRANSACTION;
            CREATE TABLE candidates_new (
                id                    TEXT PRIMARY KEY,
                candidate_number      TEXT NOT NULL,
                full_name             TEXT NOT NULL,
                nickname              TEXT,
                gender                TEXT NOT NULL CHECK(gender IN ('male', 'female')),
                department            TEXT NOT NULL,
                photo_path            TEXT,
                is_eligible           INTEGER NOT NULL DEFAULT 1,
                is_in_tiebreak        INTEGER NOT NULL DEFAULT 0,
                disqualification_note TEXT,
                created_at            TEXT NOT NULL,
                UNIQUE(candidate_number, gender)
            );
            INSERT INTO candidates_new (id, candidate_number, full_name, nickname, gender, department, photo_path, is_eligible, disqualification_note, created_at, is_in_tiebreak)
            SELECT id, candidate_number, full_name, nickname, gender, department, photo_path, is_eligible, disqualification_note, created_at, is_in_tiebreak FROM candidates;
            DROP TABLE candidates;
            ALTER TABLE candidates_new RENAME TO candidates;
            COMMIT;"
        ) {
            eprintln!("Migration failed: {}", e);
        }
    }

    // Quick migration for existing databases
    let _ = conn.execute("ALTER TABLE judges ADD COLUMN session_token TEXT", []);
    let _ = conn.execute("ALTER TABLE judges ADD COLUMN photo_path TEXT", []);
    let _ = conn.execute("ALTER TABLE judges ADD COLUMN password TEXT", []);

    // Special Awards
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

    // Past Events Archive
    conn.execute(
        "CREATE TABLE IF NOT EXISTS past_events (
            id            TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            subtitle      TEXT,
            event_date    TEXT,
            winners_json  TEXT NOT NULL,
            created_at    TEXT NOT NULL
        )",
        [],
    )?;

    // System Logs
    conn.execute(
        "CREATE TABLE IF NOT EXISTS system_logs (
            id          TEXT PRIMARY KEY,
            level       TEXT NOT NULL,
            source      TEXT NOT NULL,
            message     TEXT NOT NULL,
            details     TEXT,
            created_at  TEXT NOT NULL
        )",
        [],
    )?;

    // Clear stale tiebreak flags on startup (safe — only used for finals tie detection)
    let _ = conn.execute("UPDATE candidates SET is_in_tiebreak = 0", []);

    Ok(conn)
}
