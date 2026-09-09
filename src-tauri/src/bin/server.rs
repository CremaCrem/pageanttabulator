use pageanttabulator_lib::{db, server};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

#[tokio::main]
async fn main() {
    let db_path = PathBuf::from("./pageant_data.db");
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
