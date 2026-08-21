use rusqlite::Connection;
use tauri::Manager;

pub fn init_db(app_handle: &tauri::AppHandle) -> Result<Connection, rusqlite::Error> {
    let app_dir = app_handle.path().app_data_dir().expect("failed to get app data dir");
    std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");
    
    let db_path = app_dir.join("pageant_data.db");
    let conn = Connection::open(db_path)?;
    
    // Create event_config table as a test
    conn.execute(
        "CREATE TABLE IF NOT EXISTS event_config (
            id INTEGER PRIMARY KEY DEFAULT 1,
            name TEXT NOT NULL,
            subtitle TEXT,
            event_date TEXT,
            venue TEXT,
            judge_count INTEGER NOT NULL DEFAULT 5,
            admin_pin TEXT NOT NULL,
            created_at TEXT NOT NULL
        )",
        [],
    )?;

    Ok(conn)
}
