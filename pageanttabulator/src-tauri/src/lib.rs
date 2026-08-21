use tauri::Manager;
use local_ip_address::local_ip;

pub mod server;
pub mod db;
pub mod scoring;

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
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize SQLite DB
            let _conn = db::schema::init_db(app.handle()).expect("Failed to initialize database");
            
            // Spawn the axum server in a background Tokio task
            tauri::async_runtime::spawn(async {
                server::start_server().await;
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_server_url])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

