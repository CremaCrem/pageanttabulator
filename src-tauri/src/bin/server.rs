use pageanttabulator_lib::{db, server};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

#[tokio::main]
async fn main() {
    let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    let dev_data_dir = project_root.join(".dev-data");
    std::fs::create_dir_all(&dev_data_dir).expect("Failed to create .dev-data directory");
    // PAGEANT_DB_PATH lets the Playwright suite run this dev server against a throwaway
    // database instead of the shared .dev-data one.
    let db_path = std::env::var("PAGEANT_DB_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| dev_data_dir.join("pageant_data.db"));
    println!("Initializing database at {:?}", db_path);
    let conn = db::schema::init_db_with_path(&db_path).expect("Failed to initialize database");

    let (ws_sender, _) = broadcast::channel(100);

    let app_state = db::AppState {
        db: Arc::new(Mutex::new(conn)),
        ws_sender: Arc::new(ws_sender),
    };

    println!("Starting standalone Pageant Tabulator server on 0.0.0.0:3000...");
    server::start_server(app_state).await;
}
