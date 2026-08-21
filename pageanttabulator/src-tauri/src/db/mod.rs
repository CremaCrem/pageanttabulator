pub mod schema;
pub mod candidates;
pub mod judges;
pub mod scores;
pub mod rounds;
pub mod event;
pub mod results;

use rusqlite::Connection;
use std::sync::{Arc, Mutex};

// A shared state for axum to inject into route handlers
#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
}

