pub mod candidates;
pub mod event;
pub mod judges;
pub mod logs;
pub mod results;
pub mod rounds;
pub mod schema;
pub mod scores;
pub mod special_awards;

use rusqlite::Connection;
use serde_json::Value;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

// A shared state for axum to inject into route handlers
#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
    pub ws_sender: Arc<broadcast::Sender<Value>>,
}
