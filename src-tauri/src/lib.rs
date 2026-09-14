use local_ip_address::local_ip;

pub mod db;
pub mod scoring;
pub mod server;


#[tauri::command]
fn get_server_url() -> String {
    if let Ok(my_local_ip) = local_ip() {
        format!("http://{}:3000", my_local_ip)
    } else {
        "http://localhost:3000".to_string()
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize SQLite DB
            let conn = db::schema::init_db(app.handle()).expect("Failed to initialize database");

            // Create a broadcast channel for WebSockets
            let (ws_sender, _) = tokio::sync::broadcast::channel(100);

            // Create shared app state for axum
            let app_state = db::AppState {
                db: std::sync::Arc::new(std::sync::Mutex::new(conn)),
                ws_sender: std::sync::Arc::new(ws_sender),
            };

            use tauri::Manager;
            app.handle().manage(app_state.clone());

            // Spawn the axum server in a background Tokio task
            tauri::async_runtime::spawn(async move {
                server::start_server(app_state).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_server_url])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
